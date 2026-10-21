"""Open a Google News link in a real browser and return the publisher's address.

Google signs its article links, so they can't be decoded locally.
way a person's would. Only used for mentions that passed the relevance check.
"""

import asyncio

from playwright.async_api import BrowserContext, async_playwright

from app.models import Post

CONCURRENCY = 4
TIMEOUT_MS = 15000
REDIRECT_WAIT_MS = (
    40000  # Google shows an interstitial for ~15 seconds before it redirects
)


def is_google(url: str | None) -> bool:
    return bool(url) and "news.google.com" in url


async def _resolve_one(context: BrowserContext, url: str) -> str | None:
    page = await context.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=TIMEOUT_MS)
        if "consent.google.com" in page.url:
            # Cookie page every visitor sees first. Decline it.
            await page.get_by_role("button", name="Reject all").first.click(
                timeout=TIMEOUT_MS
            )
        await page.wait_for_url(
            lambda u: "google.com" not in u, timeout=REDIRECT_WAIT_MS
        )
        return page.url
    except Exception:
        return None
    finally:
        await page.close()


async def resolve_links(posts: list[Post]) -> list[Post]:
    """Fill `link` on each post. Posts stay unresolved if the page won't open."""
    todo = [p for p in posts if is_google(p.url) and not p.link]
    if not todo:
        return posts
    gate = asyncio.Semaphore(CONCURRENCY)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = (
            await browser.new_context()
        )  # one session, so the cookie choice is remembered

        async def work(p: Post) -> None:
            async with gate:
                p.link = await _resolve_one(context, p.url)

        await work(todo[0])  # the first link answers the cookie page
        await asyncio.gather(*(work(p) for p in todo[1:]))
        await browser.close()
    return posts
