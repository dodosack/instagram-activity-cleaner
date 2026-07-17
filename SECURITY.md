# Security

## Do not execute foreign code ;)

Pasting code into the browser console runs it with full access to whatever page
you are on. On a page where you are logged in, that code can act as you.

- Read every line before you paste it. Every time. Including the scripts in
  this repo.
- If you cannot read JavaScript, ask someone who can, or do not run it.
- Never paste a script someone sent you because they told you to. This is a
  known scam ("self-XSS"). Attackers ask you to paste code that hands them your
  session.

## What these scripts do and do not do

They:
- click Instagram's existing "Select" and "Unlike" buttons in the page.

They do not:
- send anything to any server other than Instagram itself,
- read or store your password, cookies, or session,
- use `eval`, remote code, or hidden network calls.

You can confirm all of the above by reading the files. They are short.

## Your responsibility

- Automating actions may break Instagram's terms of use. That is your call.
- Unliking cannot be undone automatically.
- Use at your own risk. The author is not responsible for account limits,
  blocks, or lost data.
