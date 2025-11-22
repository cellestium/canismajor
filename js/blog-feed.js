// Blog list wiring for Netlify CMS + GitHub + Webflow cards

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

// Very small front matter parser for Netlify CMS style:
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

// -------- Rendering into your Webflow block --------

// Clone the Webflow card-row and fill it with post data
function createCardFromTemplate(cardRowTemplate, post) {
  const clone = cardRowTemplate.cloneNode(true);

  // Title inside <h3 class="row-heading">
  const titleEl = clone.querySelector("h3.row-heading");
  if (titleEl) titleEl.textContent = post.title;

  // Optional: you can show description if you later add a <p> for it
  // const descEl = clone.querySelector(".row-text p");
  // if (descEl && post.description) descEl.textContent = post.description;

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

  // Clickable overlay link
  const link = clone.querySelector(".card-row-item-link");
  if (link) {
    // We'll wire this to detail_post.html for now; slug comes from front matter or filename
    link.href = `detail_post.html?slug=${encodeURIComponent(post.slug)}`;
  }

  return clone;
}

// Render all posts into the blog list on blog.html
function renderBlogList(posts) {
  const wrapper = document.getElementById("blog-list-page");
  if (!wrapper) return;

  const list = wrapper.querySelector('[role="list"]');
  if (!list) return;

  // Use the existing card as template
  const cardRowTemplate =
    list.querySelector(".card-row") || list.querySelector(".card-row-item");
  if (!cardRowTemplate) return;

  // Clear list
  list.innerHTML = "";

  posts.forEach((post) => {
    const card = createCardFromTemplate(cardRowTemplate, post);
    list.appendChild(card);
  });
}

// -------- Boot --------

document.addEventListener("DOMContentLoaded", async () => {
  const posts = await fetchPosts();
  renderBlogList(posts);
});

