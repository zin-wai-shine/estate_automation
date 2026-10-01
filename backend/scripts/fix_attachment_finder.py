import re, sys

path = '/Users/zinwaishine/Desktop/Project_EA/backend/scripts/browser_server.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the block to replace: from "const attachmentInfo = await page.evaluate((ctx) => {" 
# up to "}, { postBoundingBox });"
pattern = re.compile(
    r'(  const attachmentInfo = await page\.evaluate\(\(ctx\) => \{).*?(  \}, \{ postBoundingBox \}\);)',
    re.DOTALL
)

replacement = '''  const attachmentInfo = await page.evaluate((ctx) => {
    const { postId } = ctx;

    // Re-identify confirmed target post container (same scoring as caption step)
    const candidateSelectors = [
      'div[role="dialog"] div[role="article"]',
      'div[role="dialog"]',
      'div[role="article"]',
      'article',
      'div[data-pagelet*="FeedUnit"]',
      'div[role="main"] div[role="article"]',
      'div[role="main"]',
    ];
    let candidates = [];
    for (const sel of candidateSelectors) {
      candidates.push(...Array.from(document.querySelectorAll(sel)));
    }
    candidates = Array.from(new Set(candidates));

    let bestContainer = null;
    let bestScore = -1;
    for (const el of candidates) {
      const text = el.innerText || '';
      if (text.length < 20) continue;
      let score = 0;
      if (text.includes('Rent') || text.includes('\\u0e43\\u0e2b\\u0e49\\u0e40\\u0e0a\\u0e48\\u0e32') || text.includes('\\u0e40\\u0e0a\\u0e48\\u0e32')) score += 500;
      if (text.includes('Bed') || text.includes('Bath') || text.includes('sqm') || text.includes('\\u0e15\\u0e23.\\u0e21.') || text.includes('Floor') || text.includes('\\u0e0a\\u0e31\\u0e49\\u0e19')) score += 500;
      if (text.includes('Tel') || text.includes('Line') || text.includes('Contact') || text.includes('\\u0e15\\u0e34\\u0e14\\u0e15\\u0e48\\u0e2d')) score += 300;
      if (text.includes('Condo') || text.includes('\\u0e04\\u0e2d\\u0e19\\u0e42\\u0e14') || text.includes('Price') || text.includes('\\u0e23\\u0e32\\u0e04\\u0e32')) score += 300;
      if (postId && postId.length > 3 && el.innerHTML && el.innerHTML.includes(postId)) score += 800;
      if (el.matches('div[role="article"], article')) score += 100;
      if (score > bestScore) { bestScore = score; bestContainer = el; }
    }

    if (!bestContainer || bestScore < 100) {
      bestContainer = candidates.find(el => el.matches('div[role="article"], article')) || candidates[0] || null;
    }
    if (!bestContainer) return { found: false, reason: 'Could not re-identify target post container' };

    // Helper to reject avatar/profile anchors
    const rejectAnchor = (a) => {
      const href = a.href || '';
      if (href.includes('/user/') || href.includes('/profile.php') || href.includes('/groups/members') || href.includes('profile_id')) return true;
      const aria = (a.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('profile') || aria.includes('avatar')) return true;
      const img = a.querySelector('img');
      if (img) {
        const cs = window.getComputedStyle(img);
        if (cs.borderRadius === '50%' || cs.borderRadius.includes('9999px')) return true;
        const src = img.src || '';
        if (/[_\\/](p|s)(32|40|50|60|80|100|120|130|160)x\\d+[_\\/.]/i.test(src)) return true;
      }
      return false;
    };

    // Query photo anchors DIRECTLY inside the confirmed container
    let photoAnchors = Array.from(bestContainer.querySelectorAll(
      'a[href*="/photo"], a[href*="fbid="], a[href*="/photos/"], a[href*="photo.php"]'
    )).filter(a => !rejectAnchor(a) && a.offsetWidth >= 60 && a.offsetHeight >= 60);

    // Fallback: any anchor in the container with a large fbcdn image
    if (photoAnchors.length === 0) {
      photoAnchors = Array.from(bestContainer.querySelectorAll('a[href*="facebook.com"]')).filter(a => {
        if (rejectAnchor(a)) return false;
        const img = a.querySelector('img[src*="scontent"], img[src*="fbcdn"]');
        return img && a.offsetWidth >= 60 && a.offsetHeight >= 60;
      });
    }

    // Sort top-left → bottom-right
    photoAnchors.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      if (Math.abs(ra.top - rb.top) > 30) return ra.top - rb.top;
      return ra.left - rb.left;
    });

    // Detect +N indicator
    let additionalCount = 0;
    const lastAnchor = photoAnchors[photoAnchors.length - 1];
    if (lastAnchor) {
      const m = (lastAnchor.innerText || '').trim().match(/\\+([0-9]+)/);
      if (m) additionalCount = parseInt(m[1], 10);
    }

    if (photoAnchors.length === 0) return { found: false, reason: 'No photo anchors found inside confirmed target post container' };

    const firstAnchor = photoAnchors[0];
    firstAnchor.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const updatedRect = firstAnchor.getBoundingClientRect();

    return {
      found: true,
      href: firstAnchor.href,
      click_x: Math.round(updatedRect.left + updatedRect.width / 2),
      click_y: Math.round(updatedRect.top + updatedRect.height / 2),
      cell_width: Math.round(updatedRect.width),
      cell_height: Math.round(updatedRect.height),
      visible_cells: photoAnchors.length,
      additional_count: additionalCount,
      estimated_total: photoAnchors.length + additionalCount,
    };
  }, { postBoundingBox, postId });'''

m = pattern.search(content)
if not m:
    print('ERROR: Pattern not found in file', file=sys.stderr)
    sys.exit(1)

new_content = content[:m.start()] + replacement + content[m.end():]
with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f'Replaced {len(m.group(0))} chars -> {len(replacement)} chars. Done.')
