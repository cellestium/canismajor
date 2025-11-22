// Blog wiring for Netlify CMS + GitHub + Webflow cards

// Adjust if your repo changes:
const GH_USER = "cellestium";
const GH_REPO = "canismajor";
const GH_BRANCH = "main";
const POSTS_PATH = "content/posts";

// -------- Fetch & parse posts --------

async function fetchPosts() {
  const apiUrl = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/contents/${POSTS_PATH}?ref=${GH_BRANCH}`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      console.error("Failed to load posts index", res.status);
      return [];
    }

    const files = await res.json();
    const mdFiles = files.filter((f) => f.name.endsWith(".md"));

    const posts = [];
    for (const f of mdFiles) {
      try {
        const rawRes = await fetch(f.download_url);
        if (!rawRes.ok) continue;
        const raw = await rawRes.text();
        const post = parseFrontmatter(raw);
        if (!post) continue;
        // Fallback slug from filename if not set
        post.slug = post.slug || f.name.replace(/\.md$/, "");
        posts.push(post);
      } catch (e) {
        console.error("Error reading post", f.name, e);
      }
    }

    // Sort newest first if date exists
    posts.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    return posts;
  } catch (err) {
    console.error("Error fetching posts", err);
    return [];
  }
}

// Very small front matter parser for Netlify CMS style
//
// ---
// title: "My post"
// date: 2025-01-01
// description: "short desc"
// featured_image: "/images/uploads/xyz.jpg"
// slug: "my-post"
// ---
// body markdown...
//
function parseFrontmatter(content) {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;

  const fmText = content.slice(3, end).trim();
  const body = content.slice(end + 4).trim();

  const post = { body };

  fmText.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    // Strip quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (["title", "description", "featured_image", "slug"].includes(key)) {
      post[key] = value;
    } else if (key === "date") {
      post.date = value;
    }
  });

  if (!post.title) return null;
  return post;
}

// -------- Rendering into your Webflow blocks --------

// Clone the Webflow card-row and fill it with post data
function createCardFromTemplate(cardRowTemplate, post) {
  const clone = cardRowTemplate.cloneNode(true);

  // Title inside <h3 class="row-heading">
  const titleEl = clone.querySelector("h3.row-heading");
  if (titleEl) titleEl.textContent = post.title;

  // Date in the property-value if you want to show it
  const dateEl = clone.querySelector(".property-value div");
  if (dateEl && post.date) {
    try {
      dateEl.textContent = new Date(post.date).toLocaleDateString();
    } catch {
      dateEl.textContent = post.date;
    }
  }

  // Card image (primary/secondary)
  const imgPrimary =
    clone.querySelector(".card-image-primary") ||
    clone.querySelector(".card-image");
  const imgSecondary = clone.querySelector(".card-image-secondary");

  if (post.featured_image) {
    if (imgPrimary) {
      imgPrimary.src = post.featured_image;
      imgPrimary.alt = post.title;
    }
    if (imgSecondary) {
      imgSecondary.src = post.featured_image;
      imgSecondary.alt = post.title;
    }
  }

  // Clickable overlay link (to detail_post.html with slug)
  const link = clone.querySelector(".card-row-item-link");
  if (link) {
    link.href = `detail_post.html?slug=${encodeURIComponent(post.slug)}`;
  }

  return clone;
}

// Render posts into a Webflow list wrapper by id (blog page, related section, etc.)
function renderList(containerId, posts, maxCount) {
  const wrapper = document.getElementById(containerId);
  if (!wrapper) return;

  const list = wrapper.querySelector('[role="list"]');
  if (!list) return;

  const cardRowTemplate =
    list.querySelector(".card-row") || list.querySelector(".card-row-item");
  if (!cardRowTemplate) return;

  list.innerHTML = "";

  (posts.slice(0, maxCount || posts.length)).forEach((post) => {
    const card = createCardFromTemplate(cardRowTemplate, post);
    list.appendChild(card);
  });
}

// Fill a single post page (detail_post.html) based on ?slug=
function renderSinglePost(posts) {
  const titleEl = document.getElementById("post-title");
  const descEl = document.getElementById("post-description");
  const bodyEl = document.getElementById("post-body");

  // If these elements don't exist, this isn't the detail page; skip
  if (!titleEl || !bodyEl) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  if (!slug) {
    titleEl.textContent = "Post not found";
    bodyEl.innerHTML = "<p>No post slug provided.</p>";
    return;
  }

  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    titleEl.textContent = "Post not found";
    bodyEl.innerHTML = "<p>Sorry, this post could not be loaded.</p>";
    return;
  }

  titleEl.textContent = post.title;
  if (descEl) descEl.textContent = post.description || "";

  // Very basic markdown-ish handling: split by blank lines into paragraphs
  const html = post.body
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
  bodyEl.innerHTML = html;
}

// -------- Boot --------

document.addEventListener("DOMContentLoaded", async () => {
  const posts = await fetchPosts();

  // Blog index page (blog.html)
  renderList("blog-list-page", posts);

  // Single post page (detail_post.html)
  renderSinglePost(posts);

  // We can later add:
  // renderList("blog-list-home", posts, 3);
  // renderList("blog-list-related", relatedPosts, 3);
});
