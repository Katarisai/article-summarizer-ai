const axios = require("axios");
const cheerio = require("cheerio");

const MAX_ARTICLE_LENGTH = 120000;

const normalizeWhitespace = (value) => value.replace(/\s+/g, " ").trim();

exports.fetchArticleContent = async (urlInput) => {
  let parsedUrl;

  try {
    parsedUrl = new URL(urlInput);
  } catch (_error) {
    throw new Error("Please enter a valid URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported.");
  }

  let html;
  try {
    const response = await axios.get(parsedUrl.toString(), {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    html = response.data;
  } catch (fetchError) {
    console.error("Fetch error:", fetchError.message);
    throw new Error(`Unable to fetch URL: ${fetchError.message}`);
  }

  if (!html) {
    throw new Error("No content received from URL.");
  }

  const $ = cheerio.load(html);

  $("script, style, noscript, iframe, svg, nav, footer, aside, .comments, #comments").remove();

  const title = normalizeWhitespace(
    $("h1").first().text() ||
    $("meta[property='og:title']").attr("content") ||
    $("title").first().text() ||
    "Untitled Article"
  );

  const contentSelectors = [
    "article",
    "[role='main']",
    ".content",
    ".article",
    ".post-content",
    ".entry-content",
    "main"
  ];

  let contentHtml = null;
  
  for (const selector of contentSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      contentHtml = element;
      break;
    }
  }

  if (!contentHtml) {
    contentHtml = $("body");
  }

  const paragraphText = contentHtml
    .find("p, h2, h3, li, blockquote")
    .map((_idx, element) => {
      const text = normalizeWhitespace($(element).text());
      return text.length > 20 ? text : "";
    })
    .get()
    .filter(Boolean)
    .join(" ");

  const fallbackText = normalizeWhitespace(contentHtml.text() || $("body").text() || "");

  const articleText = (paragraphText || fallbackText)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ARTICLE_LENGTH);

  if (!articleText || articleText.length < 100) {
    throw new Error("Could not extract enough article content from this URL. (Minimum 100 characters required.)");
  }

  return {
    title,
    url: parsedUrl.toString(),
    text: articleText
  };
};
