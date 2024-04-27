import { requestAsyncStorage } from './request-async-storage.external'
import type { ResponseCookies } from '../../server/web/spec-extension/cookies'
import { actionAsyncStorage } from './action-async-storage.external'
import { RedirectStatusCode } from './redirect-status-code'

const REDIRECT_ERROR_CODE = 'NEXT_REDIRECT'

export enum RedirectType {
  push = 'push',
  replace = 'replace',
}

export type RedirectError<U extends string> = Error & {
  digest: `${typeof REDIRECT_ERROR_CODE};${RedirectType};${U};${RedirectStatusCode};`
  mutableCookies: ResponseCookies
}

export function getRedirectError(
  url: string,
  type: RedirectType,
  statusCode: RedirectStatusCode = RedirectStatusCode.TemporaryRedirect
): RedirectError<typeof url> {
  const error = new Error(REDIRECT_ERROR_CODE) as RedirectError<typeof url>
  error.digest = `${REDIRECT_ERROR_CODE};${type};${url};${statusCode};`
  const requestStore = requestAsyncStorage.getStore()
  if (requestStore) {
    error.mutableCookies = requestStore.mutableCookies
  }
  return error
}

/**
 * This function allows you to redirect the user to another URL. It can be used in
 * [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components),
 * [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers), and
 * [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations).
 *
 * - In a Server Component, this will insert a meta tag to redirect the user to the target page.
 * - In a Route Handler or Server Action, it will serve a 307/303 to the caller.
 *
 * Read more: [Next.js Docs: `redirect`](https://nextjs.org/docs/app/api-reference/functions/redirect)
 */
export function redirect(
  /** The URL to redirect to */
  url: string,
  type: RedirectType = RedirectType.replace
): never {
  const actionStore = actionAsyncStorage.getStore()
  throw getRedirectError(
    url,
    type,
    // If we're in an action, we want to use a 303 redirect
    // as we don't want the POST request to follow the redirect,
    // as it could result in erroneous re-submissions.
    actionStore?.isAction
      ? RedirectStatusCode.SeeOther
      : RedirectStatusCode.TemporaryRedirect
  )
}

/**
 * This function allows you to redirect the user to another URL. It can be used in
 * [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components),
 * [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers), and
 * [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations).
 *
 * - In a Server Component, this will insert a meta tag to redirect the user to the target page.
 * - In a Route Handler or Server Action, it will serve a 308/303 to the caller.
 *
 * Read more: [Next.js Docs: `redirect`](https://nextjs.org/docs/app/api-reference/functions/redirect)
 */
export function permanentRedirect(
  /** The URL to redirect to */
  url: string,
  type: RedirectType = RedirectType.replace
): never {
  const actionStore = actionAsyncStorage.getStore()
  throw getRedirectError(
    url,
    type,
    // If we're in an action, we want to use a 303 redirect
    // as we don't want the POST request to follow the redirect,
    // as it could result in erroneous re-submissions.
    actionStore?.isAction
      ? RedirectStatusCode.SeeOther
      : RedirectStatusCode.PermanentRedirect
  )
}

/**
 * Checks an error to determine if it's an error generated by the
 * `redirect(url)` helper.
 *
 * @param error the error that may reference a redirect error
 * @returns true if the error is a redirect error
 */
export function isRedirectError<U extends string>(
  error: unknown
): error is RedirectError<U> {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('digest' in error) ||
    typeof error.digest !== 'string'
  ) {
    return false
  }

  const digest = error.digest.split(';')
  const [errorCode, type] = digest
	const destination = digest.slice(2, -2).join(';')
	const status = digest.at(-2)

	console.log([errorCode, type, destination, status])

  const statusCode = Number(status)

  return (
    errorCode === REDIRECT_ERROR_CODE &&
    (type === 'replace' || type === 'push') &&
    typeof destination === 'string' &&
    !isNaN(statusCode) &&
    statusCode in RedirectStatusCode
  )
}

/**
 * Returns the encoded URL from the error if it's a RedirectError, null
 * otherwise. Note that this does not validate the URL returned.
 *
 * @param error the error that may be a redirect error
 * @return the url if the error was a redirect error
 */
export function getURLFromRedirectError<U extends string>(
  error: RedirectError<U>
): U
export function getURLFromRedirectError(error: unknown): string | null {
  if (!isRedirectError(error)) return null

  // Slices off the beginning of the digest that contains the code and the
  // separating ';'.
  return error.digest.split(';').slice(2, -2).join(";")
}

export function getRedirectTypeFromError<U extends string>(
  error: RedirectError<U>
): RedirectType {
  if (!isRedirectError(error)) {
    throw new Error('Not a redirect error')
  }

  return error.digest.split(';', 2)[1] as RedirectType
}

export function getRedirectStatusCodeFromError<U extends string>(
  error: RedirectError<U>
): number {
  if (!isRedirectError(error)) {
    throw new Error('Not a redirect error')
  }

  return Number(error.digest.split(';').at(-2))
}
