## Hacktoberfest Anti-Spam ##

Amazing project.

Every October, Digital Ocean runs a DDoS attack against the free software
community as part of a marketing campaign. Unfortunately, it seems that they
are either unwilling or unable to curb [the massive spam issues][spam] on their
end, so this GitHub Action was born. It's basically a spam filter for GitHub
pull requests made during Hacktoberfest.

This idea was shamelessly stolen from [the Exercism project][exercism-pr972],
but the rules for permitting PRs have been expanded a bit to avoid blocking all
contributions from new users and to detect contributors more accurately. The
current heuristic is:

 * If it is not currently October [Anywhere on Earth][AoE-tzinfo], then it is
   not currently Hacktoberfest and nothing special happens.

 * If the user is an existing contributor to the repository, the pull request
   is allowed. A user is an "existing contributor" if any of the following is
   true:

	 - The user is a collaborator on the GitHub repository (this includes
	   outside collaborators of a repository that have access to the
	   repository).

     - If the repository owner is an organisation, the user is a member of the
       organisation (includes private memberships).

     - GitHub considers the user to be a code contributor (this is calculated
       based on whether there exists a commit which has an email address
       associated with it that is registered with their account).

 * Otherwise, the user is not considered to be an "existing contributor" to the
   project, and thus both of the following conditions have to be true in order
   for the PR to be considered non-spam.

   The logic behind this is that we don't want to block all new contributors
   for an entire month, so we should have some minimal bars for contributors to
   cross during October (though a dedicated spammer could work around these
   quite easily).

   - Any one of the following is true:

     1. The user's account was created at least 12 months before the start of
        October in the current year.
     2. The user's account was created at least 6 months before the start of
        October in the current year, and has more than 25 contribution events
        listed on their profile statistics this year.
     3. The user's account was created at least 3 months before the start of
        October in the current year, and has more than 75 contribution events
        listed on their profile statistics this year.

   - The user has created at least 3 comments in the project issues or PRs
	 between the start of the current year and 1 month before the start of
	 October in the current year.

   If you wish to go with the "nuclear option" and consider all users who
   aren't "existing contributors" by the above definition as spam, set the
   `all_new_contributors_are_spam` input to `true`.

If the pull request is considered spam, it is closed and tagged "invalid" with
a comment explaining the reason for it being closed. Maintainers can optionally
set the `aggressive_spam_retaliation` input to `true` which goes a step further
and additionally labels it as "spam", and locks the pull request with the
"spam" justification.

[spam]: https://blog.domenic.me/hacktoberfest/
[AoE-tzinfo]: https://en.wikipedia.org/wiki/Anywhere_on_Earth
[exercism-pr972]: https://github.com/exercism/website/pull/972
[parse-duration]: https://www.npmjs.com/package/parse-duration

### License ###

This code is licensed under the MIT license.

```
Copyright (c) 2020 Aleksa Sarai <cyphar@cyphar.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
