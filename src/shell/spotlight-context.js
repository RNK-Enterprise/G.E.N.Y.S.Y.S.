/**
 * Axis™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

function getAxisSpotlightContext(host, title, url) {
    const lowerHost = String(host || '').toLowerCase();
    const lowerTitle = String(title || '').toLowerCase();
    const lowerUrl = String(url || '').toLowerCase();

    if (
        lowerHost.includes('github.') ||
        lowerHost.includes('gitlab.') ||
        lowerHost.includes('bitbucket.') ||
        lowerUrl.includes('/pull/') ||
        lowerUrl.includes('/issues/') ||
        lowerUrl.includes('/commit/') ||
        lowerTitle.includes('repository')
    ) {
        if (lowerUrl.includes('/pull/') || lowerUrl.includes('/issues/') || lowerUrl.includes('/commit/')) {
            return 'dev';
        }
        return 'code';
    }

    if (
        lowerHost.includes('docs.') ||
        lowerHost.includes('developer.') ||
        lowerHost.includes('learn.') ||
        lowerHost.includes('support.') ||
        lowerHost.includes('stackoverflow.') ||
        lowerUrl.includes('/docs') ||
        lowerTitle.includes('documentation')
    ) {
        return 'docs';
    }

    if (
        lowerHost.includes('openai.') ||
        lowerHost.includes('chatgpt.') ||
        lowerHost.includes('claude.') ||
        lowerHost.includes('gemini.') ||
        lowerHost.includes('copilot.') ||
        lowerHost.includes('perplexity.') ||
        lowerHost.includes('ai.') ||
        lowerTitle.includes('ai assistant') ||
        lowerTitle.includes('chatgpt') ||
        lowerTitle.includes('copilot') ||
        lowerTitle.includes('gemini')
    ) {
        return 'ai';
    }

    if (
        lowerHost.includes('news.') ||
        lowerHost.includes('blog.') ||
        lowerHost.includes('article.') ||
        lowerTitle.includes('news') ||
        lowerTitle.includes('article')
    ) {
        return 'news';
    }

    if (
        lowerHost.includes('jira.') ||
        lowerHost.includes('linear.') ||
        lowerHost.includes('notion.') ||
        lowerHost.includes('confluence.') ||
        lowerHost.includes('figma.')
    ) {
        return 'workspace';
    }

    if (
        lowerHost.includes('automation.') ||
        lowerHost.includes('workflow.') ||
        lowerTitle.includes('automation') ||
        lowerTitle.includes('workflow') ||
        lowerTitle.includes('script') ||
        lowerTitle.includes('macro')
    ) {
        return 'automation';
    }

    if (
        lowerHost.includes('slack.') ||
        lowerHost.includes('teams.') ||
        lowerHost.includes('discord.') ||
        lowerHost.includes('chat.') ||
        lowerHost.includes('meet.') ||
        lowerHost.includes('mail.') ||
        lowerHost.includes('outlook.') ||
        lowerHost.includes('gmail.')
    ) {
        return 'comms';
    }

    if (
        lowerHost.includes('localhost') ||
        lowerHost === '127.0.0.1' ||
        lowerUrl.includes('localhost') ||
        lowerUrl.includes('127.0.0.1')
    ) {
        return 'dev';
    }

    if (
        lowerHost.includes('youtube.') ||
        lowerHost.includes('youtu.be') ||
        lowerHost.includes('spotify.') ||
        lowerHost.includes('soundcloud.') ||
        lowerHost.includes('vimeo.') ||
        lowerHost.includes('twitch.') ||
        lowerHost.includes('netflix.')
    ) {
        return 'media';
    }

    if (
        lowerHost.includes('extensions.') ||
        lowerHost.includes('addons.') ||
        lowerHost.includes('plugins.') ||
        lowerTitle.includes('extension') ||
        lowerTitle.includes('addon') ||
        lowerTitle.includes('plugin') ||
        lowerUrl.includes('/extensions')
    ) {
        return 'extensions';
    }

    if (
        lowerHost.includes('downloads.') ||
        lowerTitle.includes('download') ||
        lowerUrl.includes('/download') ||
        /\.(zip|7z|rar|tar|gz|tgz|pdf|csv|json|mp4|mp3|wav|png|jpg|jpeg|gif|webm)(?:[?#]|$)/i.test(lowerUrl)
    ) {
        return 'downloads';
    }

    if (
        lowerHost.includes('search.') ||
        lowerHost.includes('google.') ||
        lowerHost.includes('bing.') ||
        lowerHost.includes('duckduckgo.') ||
        lowerHost.includes('yahoo.')
    ) {
        return 'search';
    }

    return 'general';
}
window.getAxisSpotlightContext = getAxisSpotlightContext;

window.getAxisSpotlightContext = getAxisSpotlightContext;
