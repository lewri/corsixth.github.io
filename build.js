// SPDX-FileCopyrightText: 2021 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import fetch from 'node-fetch';
import fs from 'fs-extra';
import Mustache from 'mustache';
import path from 'path';
import RssParser from 'rss-parser';

const ASSETS_DIR = 'assets';
const BUILD_DIR = 'build';
const TEMPLATES_DIR = 'templates';

const FEEDS = [
	'https://corsixth.lewri.me/index.php/feed/',
];


async function build() {
	await copyAssets();
	await renderPages();
}

async function copyAssets() {
	console.log('Copying assets...')
	await fs.copy(ASSETS_DIR, BUILD_DIR);
}

async function renderPages() {
	console.log('Rendering pages...');
	const data = {
		releases: await getReleases(),
		posts: await getPosts(),
    currentYear: new Date().getUTCFullYear(),
		formatDate: () => (date, render) => (new Date(Date.parse(render(date)))).toLocaleDateString('en-GB', { year: 'numeric', month: 'numeric', day: 'numeric' }),
	};
	const templates = {
		base: await fs.readFile(path.join(TEMPLATES_DIR, 'base.mustache'), { encoding: 'utf-8' }),
		header: await fs.readFile(path.join(TEMPLATES_DIR, 'includes', 'header.mustache'), { encoding: 'utf-8' }),
		nav: await fs.readFile(path.join(TEMPLATES_DIR, 'includes', 'nav.mustache'), { encoding: 'utf-8' }),
		footer: await fs.readFile(path.join(TEMPLATES_DIR, 'includes', 'footer.mustache'), { encoding: 'utf-8' }),
	}
	await renderPage(path.join(TEMPLATES_DIR, 'pages', 'index.mustache'), data, templates, path.join(BUILD_DIR, 'index.html'));
	await renderPage(path.join(TEMPLATES_DIR, 'pages', 'media.mustache'), data, templates, path.join(BUILD_DIR, 'media.html'));
	await renderPage(path.join(TEMPLATES_DIR, 'pages', 'download.mustache'), data, templates, path.join(BUILD_DIR, 'download.html'));
}

async function getReleases() {
	console.log('Fetching latests releases...');
	const response = await fetch(
		'https://api.github.com/repos/CorsixTH/CorsixTH/releases?per_page=5',
		{
			headers: { 'accept': 'application/vnd.github.v3+json' },
		}
	);
	if (!response.ok) throw new Error('Unable to fetch latest releases.');
	const releases = await response.json();
	return await Promise.all(releases.map(async release => {
		return {
			title: release.name,
			date: new Date(Date.parse(release.published_at)),
			url: release.html_url,
		}
	}));
}

async function getPosts() {
	let posts = [];
	for (const url of FEEDS) {
		console.log(`Fetching RSS feed '${url}'...`);
		const parser = new RssParser();
		try {
			const feed = await parser.parseURL(url);
			feed.items.forEach(item => posts.push({
				title: item.title,
				date: new Date(Date.parse(item.pubDate)),
				url: item.link,
				source: { title: feed.title, url: feed.link },
			}));
		} catch (e) {
			console.warn(e);
		}
	}
	posts.sort((a, b) => a.date < b.date).splice(5);
	return posts;
}

async function renderPage(templatePath, data, templates, outputPath) {
	console.log(`Rendering ${outputPath}`);
	templates.content = await fs.readFile(templatePath, { encoding: 'utf-8' });
	data.id = path.basename(outputPath, '.html');
	const output = Mustache.render(templates.base, data, templates);
	await fs.writeFile(outputPath, output);
}

build();


export {
	build,
	copyAssets,
	renderPages,
	ASSETS_DIR,
	BUILD_DIR,
	TEMPLATES_DIR,
};
