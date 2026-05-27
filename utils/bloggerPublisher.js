// ================================================================
//  BioXape — Blogger Auto-Publisher Utility
//  FILE: utils/bloggerPublisher.js
// ================================================================

const { google } = require('googleapis');

const getBloggerClient = () => {
  const auth = new google.auth.OAuth2(
    process.env.BLOGGER_CLIENT_ID,
    process.env.BLOGGER_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.BLOGGER_REFRESH_TOKEN });
  return google.blogger({ version: 'v3', auth });
};

const publishToBlogger = async (post) => {
  try {
    if (!process.env.BLOGGER_REFRESH_TOKEN || process.env.BLOGGER_REFRESH_TOKEN === 'your_blogger_oauth_refresh_token') {
      console.log('⚠️  Blogger API not configured. Auto-publish skipped.');
      return { success: false, skipped: true };
    }

    const blogger = getBloggerClient();

    // Build labels array from all categories + content type
    const labels = [...(post.allCategories || [post.category])];
    if (post.contentType) labels.push(post.contentType);
    if (post.tags) labels.push(...post.tags);

    // Deduplicate labels
    const uniqueLabels = [...new Set(labels)];

    // Build post HTML with cover image at top
    const fullContent = `
      ${post.coverImageUrl ? `<div class="bx-post-cover"><img src="${post.coverImageUrl}" alt="${post.title}" style="width:100%;border-radius:12px;margin-bottom:24px"/></div>` : ''}
      <div class="bx-post-body">
        ${post.bodyHtml}
      </div>
    `;

    const response = await blogger.posts.insert({
      blogId: process.env.BLOGGER_BLOG_ID,
      requestBody: {
        title:   post.title,
        content: fullContent,
        labels:  uniqueLabels,
      },
    });

    const bloggerPost = response.data;
    console.log(`✅ Published to Blogger: ${bloggerPost.url}`);

    return {
      success: true,
      postId:  bloggerPost.id,
      postUrl: bloggerPost.url,
    };
  } catch (err) {
    console.error('❌ Blogger publish error:', err.message);
    return { success: false, error: err.message };
  }
};

const updateBloggerPost = async (bloggerPostId, post) => {
  try {
    const blogger = getBloggerClient();
    await blogger.posts.update({
      blogId: process.env.BLOGGER_BLOG_ID,
      postId: bloggerPostId,
      requestBody: {
        title:   post.title,
        content: post.bodyHtml,
        labels:  post.allCategories || [],
      },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

module.exports = { publishToBlogger, updateBloggerPost };
