/*
 * Copyright (c) 2020 Aleksa Sarai <cyphar@cyphar.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const got = require("got");
const cheerio = require("cheerio");
const { DateTime } = require("luxon");

const core = require("@actions/core");
const { context, getOctokit } = require("@actions/github");

const githubToken = core.getInput("github-token", { required: true });
const github = getOctokit(githubToken);

const now = DateTime.utc();
const thisOctober =
	DateTime.utc(now.year, 10, 1, 12, 0, 0).until(DateTime.utc(now.year, 11, 1, 12, 0, 0));

async function isExistingContributor(creator, repo) {
	// Does GitHub think they're a contributor?
	if (repo.owner.type === "Organization") {
		let { code } = await github.request("GET /orgs/:org/members/:user", {
			org: repo.owner.login,
			user: creator,
		});
		if (code === 204)
			return true;

		// Weren't allowed to access the private contributors, check public.
		if (code !== 404) {
			let { code } = await github.request("GET /orgs/:org/public_members/:user", {
				org: repo.owner.login,
				user: creator,
			});
			if (code === 204)
				return true;
		}
	}

	// Does GitHub think they're a collaborator?
	let { code } = await github.request("GET /repos/:owner/:repo/collaborators/:user", {
		owner: repo.owner.login,
		repo: repo.name,
		user: creator,
	});
	if (code === 204)
		return true;

	// Are they are a previous contributor?
	const contributors = await github.paginate(
		github.repos.listContributors,
		{ owner: repo.owner.login, repo: repo.name },
		(response) => response.data.map((user) => user.login),
	);
	if (contributors.contains(creator))
		return true;

	return false;
}

async function contributionGraphCount(user, year, until) {
	try {
		let response = await got(`https://github.com/users/${user}/contributions?from=${year}-01-01`);
		let $ = cheerio.load(response.body);

		let total = 0;

		$("svg rect.day").each((i, elem) => {
			const date = DateTime.parseISO($(elem).attr("data-date"));
			const count = parseInt($(elem).attr("data-count"));

			if (date.diff(until).as("day") < 0)
				total += count;
		});
	} catch (error) {
		return 0;
	}
}

async function newContributorScore(creator, repo) {
	const userCreated = DateTime.parseISO(creator.created_at);
	const userAgeMonths = thisOctober.start.diff(userCreated).as("months");
	const totalContributions = contributionGraphCount(creator.login, now.year, thisOctober.start);

	let score = 0;

	if ((userAgeMonths > 12) ||
	    (userAgeMonths > 6 && totalContributions >= 25) ||
	    (userAgeMonths > 3 && totalContributions >= 75))
		score++;

	let requiredComments = 3;
	for await (const comment of github.paginate.iterator(
		github.repos.listCommentsForRepo,
		{ owner: repo.owner.login, repo: repo.name, since: `${now.year}-01-01T00:00:00Z` },
	)) {
		const created = DateTime.parseISO(comment.created_at);

		if (comment.user.login !== creator.login)
			continue;

		if (created.diff(thisOctober.start).as("months") <= 1)
			continue;

		requiredComments--;
		if (!requiredComments) {
			score++;
			break;
		}
	}

	return score;
}

async function checkSpam() {
	const noNewContributors = core.getInput("all_new_contributors_are_spam") === "true";
	const minimumNewContributorScore = 2;

	const creator = context.payload.sender.login;
	const repo = context.payload.repository;

	// Only care about newly-opened PRs.
	if (context.eventName !== "pull_request" || context.payload.action !== "opened")
		return false;

	// If it's not October, we don't care.
	if (!thisOctober.contains(now))
		return false;

	// Is the user an existing contributor?
	if (await isExistingContributor(creator, repo))
		return false;

	// Is the user a reasonable new contributor?
	return !noNewContributors &&
			await newContributorScore(creator, repo) >= minimumNewContributorScore;
}

async function replySpam() {
	const aggressiveResponse = core.getInput("aggressive_spam_retaliation") === "true";

	const creator = context.payload.sender.login;
	const repo = context.payload.repository;

	const issueOpts = {
		owner: repo.owner.login,
		repo: repo.name,
		issue_number: context.payload.number,
	}

	// Add the "invalid" label, plus "spam" if aggressive.
	let labels = [ "invalid" ];
	if (aggressiveResponse)
		labels.push("spam");
	await github.issues.addLabels({
		...issueOpts,
		labels,
	});

	// Close the PR.
	await github.issues.update({
		...issueOpts,
		state: "closed",
	});

	// Send a comment.
	await github.issues.createComment({
		...issueOpts,
		body: "This pull request has been closed and marked invalid because it appears to be Hacktoberfest-related spam."
	});

	// If aggressive, lock for spam.
	if (aggressiveResponse) {
		await github.issues.lock({
			...issueOpts,
			lock_reason: "spam",
		});
	}
}

async function main() {
	const wasSpam = await checkSpam();
	if (wasSpam)
		await replySpam();
	core.setOutput("spam", wasSpam);
}

(async () => {
	try {
		await main();
	} catch (error) {
		core.setFailed(error.message);
	}
})();
