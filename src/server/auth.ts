import { generateAvailableUsername } from '@wasp/core/auth.js'

export async function getUserFields(_context: unknown, args: any) {
  const username = await generateAvailableUsername(args.profile.displayName.split(' '), { separator: '.' })
  const email = args.profile.emails[0].value;
  return { username, email };
}

export function config() {
  const clientID = "451488821164-59l9qq00c97sarq5ci79g53t93ga9u0o.apps.googleusercontent.com " 
  const clientSecret = "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"
  return {
    clientID, // look up from env or elsewhere,
    clientSecret, // look up from env or elsewhere,
    scope: ['profile', 'email'], // must include at least 'profile' for Google
  };
}
