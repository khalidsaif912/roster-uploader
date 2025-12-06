// netlify/functions/upload-to-github.js

const REPO_OWNER = "khalidsaif912";
const REPO_NAME = "roster-images";

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "GITHUB_TOKEN is not configured" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { files, note } = body;

    if (!Array.isArray(files) || files.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No files provided" }),
      };
    }

    const results = [];

    for (const file of files) {
      const filePath = file.name; // في الجذر مباشرة
      const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filePath)}`;

      // نتحقق إذا الملف موجود أصلاً (لأخذ sha للتحديث)
      let existingSha = null;
      const getRes = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "netlify-uploader",
        },
      });

      if (getRes.ok) {
        const existing = await getRes.json();
        existingSha = existing.sha;
      }

      const commitMessage = `Upload ${file.name}` + (note ? ` - ${note}` : "");

      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "netlify-uploader",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: commitMessage,
          content: file.content, // Base64 بدون prefix
          sha: existingSha || undefined,
        }),
      });

      if (!putRes.ok) {
        const errorText = await putRes.text();
        throw new Error(`GitHub API error for ${file.name}: ${errorText}`);
      }

      const resultJson = await putRes.json();
      results.push({ file: file.name, path: resultJson.content.path });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, files: results }),
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Server error" }),
    };
  }
};
