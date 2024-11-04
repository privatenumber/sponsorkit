import process from 'node:process';
import yargs from 'yargs';
import { S as SvgComposer, g as generateBadge, b as base64ToArrayBuffer, p as pngToDataUri, r as round, a as partitionTiers, t as tierPresets, v as version, l as loadConfig, c as resolveProviders, d as guessProviders, e as resolveAvatars, s as svgToPng } from './shared/sponsorkit.fa0c6098.mjs';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { resolve, dirname, join, relative } from 'node:path';
import { notNullish } from '@antfu/utils';
import { consola } from 'consola';
import c from 'picocolors';
import 'unconfig';
import 'dotenv';
import 'node:buffer';
import 'ofetch';
import 'sharp';
import 'node:crypto';
import 'normalize-url';

const circlesRenderer = {
  name: "sponsorkit:circles",
  async renderSVG(config, sponsors) {
    const { hierarchy, pack } = await import('d3-hierarchy');
    const composer = new SvgComposer(config);
    const amountMax = Math.max(...sponsors.map((sponsor) => sponsor.monthlyDollars));
    const {
      radiusMax = 300,
      radiusMin = 10,
      radiusPast = 5,
      weightInterop = defaultInterop
    } = config.circles || {};
    function defaultInterop(sponsor) {
      return sponsor.monthlyDollars < 0 ? radiusPast : lerp(radiusMin, radiusMax, (Math.max(0.1, sponsor.monthlyDollars || 0) / amountMax) ** 0.9);
    }
    if (!config.includePastSponsors)
      sponsors = sponsors.filter((sponsor) => sponsor.monthlyDollars > 0);
    const root = hierarchy({ ...sponsors[0], children: sponsors, id: "root" }).sum((d) => weightInterop(d, amountMax)).sort((a, b) => (b.value || 0) - (a.value || 0));
    const p = pack();
    p.size([config.width, config.width]);
    p.padding(config.width / 400);
    const circles = p(root).descendants().slice(1);
    for (const circle of circles) {
      composer.addRaw(generateBadge(
        circle.x - circle.r,
        circle.y - circle.r,
        await getRoundedAvatars(circle.data.sponsor),
        {
          name: false,
          boxHeight: circle.r * 2,
          boxWidth: circle.r * 2,
          avatar: {
            size: circle.r * 2
          }
        }
      ));
    }
    composer.height = config.width;
    return composer.generateSvg();
  }
};
function lerp(a, b, t) {
  if (t < 0)
    return a;
  return a + (b - a) * t;
}
async function getRoundedAvatars(sponsor) {
  if (!sponsor.avatarBuffer || sponsor.type === "User")
    return sponsor;
  const data = base64ToArrayBuffer(sponsor.avatarBuffer);
  return {
    ...sponsor,
    avatarUrlHighRes: pngToDataUri(await round(data, 0.5, 120)),
    avatarUrlLowRes: pngToDataUri(await round(data, 0.5, 50)),
    avatarUrlMediumRes: pngToDataUri(await round(data, 0.5, 80))
  };
}

const tiersRenderer = {
  name: "sponsorkit:tiers",
  async renderSVG(config, sponsors) {
    const composer = new SvgComposer(config);
    await (config.customComposer || tiersComposer)(composer, sponsors, config);
    return composer.generateSvg();
  }
};
async function tiersComposer(composer, sponsors, config) {
  const tierPartitions = partitionTiers(sponsors, config.tiers, config.includePastSponsors);
  composer.addSpan(config.padding?.top ?? 20);
  tierPartitions.forEach(({ tier: t, sponsors: sponsors2 }) => {
    t.composeBefore?.(composer, sponsors2, config);
    if (t.compose) {
      t.compose(composer, sponsors2, config);
    } else {
      const preset = t.preset || tierPresets.base;
      if (sponsors2.length && preset.avatar.size) {
        const paddingTop = t.padding?.top ?? 20;
        const paddingBottom = t.padding?.bottom ?? 10;
        if (paddingTop)
          composer.addSpan(paddingTop);
        if (t.title) {
          composer.addTitle(t.title).addSpan(5);
        }
        composer.addSponsorGrid(sponsors2, preset);
        if (paddingBottom)
          composer.addSpan(paddingBottom);
      }
    }
    t.composeAfter?.(composer, sponsors2, config);
  });
  composer.addSpan(config.padding?.bottom ?? 20);
}

const builtinRenderers = {
  tiers: tiersRenderer,
  circles: circlesRenderer
};

function r(path) {
  return `./${relative(process.cwd(), path)}`;
}
async function run(inlineConfig, t = consola) {
  t.log(`
${c.magenta(c.bold("SponsorKit"))} ${c.dim(`v${version}`)}
`);
  const fullConfig = await loadConfig(inlineConfig);
  const config = fullConfig;
  const dir = resolve(process.cwd(), config.outputDir);
  const cacheFile = resolve(dir, config.cacheFile);
  const providers = resolveProviders(config.providers || guessProviders(config));
  if (config.renders?.length) {
    const names = /* @__PURE__ */ new Set();
    config.renders.forEach((renderOptions, idx) => {
      const name = renderOptions.name || "sponsors";
      if (names.has(name))
        throw new Error(`Duplicate render name: ${name} at index ${idx}`);
      names.add(name);
    });
  }
  const linksReplacements = normalizeReplacements(config.replaceLinks);
  const avatarsReplacements = normalizeReplacements(config.replaceAvatars);
  let allSponsors = [];
  if (!fs.existsSync(cacheFile) || config.force) {
    for (const i of providers) {
      t.info(`Fetching sponsorships from ${i.name}...`);
      let sponsors = await i.fetchSponsors(config);
      sponsors.forEach((s) => s.provider = i.name);
      sponsors = await config.onSponsorsFetched?.(sponsors, i.name) || sponsors;
      t.success(`${sponsors.length} sponsorships fetched from ${i.name}`);
      allSponsors.push(...sponsors);
    }
    allSponsors = await config.onSponsorsAllFetched?.(allSponsors) || allSponsors;
    {
      let pushGroup = function(group) {
        const existingSets = new Set(group.map((s) => sponsorsMergeMap.get(s)).filter(notNullish));
        let set;
        if (existingSets.size === 1) {
          set = [...existingSets.values()][0];
        } else if (existingSets.size === 0) {
          set = new Set(group);
        } else {
          set = /* @__PURE__ */ new Set();
          for (const s of existingSets) {
            for (const i of s)
              set.add(i);
          }
        }
        for (const s of group) {
          set.add(s);
          sponsorsMergeMap.set(s, set);
        }
      }, matchSponsor = function(sponsor, matcher) {
        if (matcher.provider && sponsor.provider !== matcher.provider)
          return false;
        if (matcher.login && sponsor.sponsor.login !== matcher.login)
          return false;
        if (matcher.name && sponsor.sponsor.name !== matcher.name)
          return false;
        if (matcher.type && sponsor.sponsor.type !== matcher.type)
          return false;
        return true;
      }, mergeSponsors = function(main, sponsors) {
        const all = [main, ...sponsors];
        main.isOneTime = all.every((s) => s.isOneTime);
        main.expireAt = all.map((s) => s.expireAt).filter(notNullish).sort((a, b) => b.localeCompare(a))[0];
        main.createdAt = all.map((s) => s.createdAt).filter(notNullish).sort((a, b) => a.localeCompare(b))[0];
        main.monthlyDollars = all.every((s) => s.monthlyDollars === -1) ? -1 : all.filter((s) => s.monthlyDollars > 0).reduce((a, b) => a + b.monthlyDollars, 0);
        main.provider = [...new Set(all.map((s) => s.provider))].join("+");
        return main;
      };
      const sponsorsMergeMap = /* @__PURE__ */ new Map();
      for (const rule of config.mergeSponsors || []) {
        if (typeof rule === "function") {
          for (const ship of allSponsors) {
            const result = rule(ship, allSponsors);
            if (result)
              pushGroup(result);
          }
        } else {
          const group = rule.flatMap((matcher) => {
            const matched = allSponsors.filter((s) => matchSponsor(s, matcher));
            if (!matched.length)
              t.warn(`No sponsor matched for ${JSON.stringify(matcher)}`);
            return matched;
          });
          pushGroup(group);
        }
      }
      if (config.sponsorsAutoMerge) {
        for (const ship of allSponsors) {
          if (!ship.sponsor.socialLogins)
            continue;
          for (const [provider, login] of Object.entries(ship.sponsor.socialLogins)) {
            const matched = allSponsors.filter((s) => s.sponsor.login === login && s.provider === provider);
            if (matched)
              pushGroup([ship, ...matched]);
          }
        }
      }
      const removeSponsors = /* @__PURE__ */ new Set();
      const groups = new Set(sponsorsMergeMap.values());
      for (const group of groups) {
        if (group.size === 1)
          continue;
        const sorted = [...group].sort((a, b) => allSponsors.indexOf(a) - allSponsors.indexOf(b));
        t.info(`Merging ${sorted.map((i) => c.cyan(`@${i.sponsor.login}(${i.provider})`)).join(" + ")}`);
        for (const s of sorted.slice(1))
          removeSponsors.add(s);
        mergeSponsors(sorted[0], sorted.slice(1));
      }
      allSponsors = allSponsors.filter((s) => !removeSponsors.has(s));
    }
    allSponsors.forEach((ship) => {
      for (const r2 of linksReplacements) {
        if (typeof r2 === "function") {
          const result = r2(ship);
          if (result) {
            ship.sponsor.linkUrl = result;
            break;
          }
        } else if (r2[0] === ship.sponsor.linkUrl) {
          ship.sponsor.linkUrl = r2[1];
          break;
        }
      }
      for (const r2 of avatarsReplacements) {
        if (typeof r2 === "function") {
          const result = r2(ship);
          if (result) {
            ship.sponsor.avatarUrl = result;
            break;
          }
        } else if (r2[0] === ship.sponsor.avatarUrl) {
          ship.sponsor.avatarUrl = r2[1];
          break;
        }
      }
    });
    t.info("Resolving avatars...");
    await resolveAvatars(allSponsors, config.fallbackAvatar, t);
    t.success("Avatars resolved");
    await fsp.mkdir(dirname(cacheFile), { recursive: true });
    await fsp.writeFile(cacheFile, JSON.stringify(allSponsors, null, 2));
  } else {
    allSponsors = JSON.parse(await fsp.readFile(cacheFile, "utf-8"));
    t.success(`Loaded from cache ${r(cacheFile)}`);
  }
  allSponsors.sort(
    (a, b) => b.monthlyDollars - a.monthlyDollars || Date.parse(b.createdAt) - Date.parse(a.createdAt) || (b.sponsor.login || b.sponsor.name).localeCompare(a.sponsor.login || a.sponsor.name)
    // ASC name
  );
  allSponsors = await config.onSponsorsReady?.(allSponsors) || allSponsors;
  if (config.renders?.length) {
    t.info(`Generating with ${config.renders.length} renders...`);
    await Promise.all(config.renders.map(async (renderOptions) => {
      const mergedOptions = {
        ...fullConfig,
        ...renderOptions
      };
      const renderer = builtinRenderers[mergedOptions.renderer || "tiers"];
      await applyRenderer(
        renderer,
        config,
        mergedOptions,
        allSponsors,
        t
      );
    }));
  } else {
    const renderer = builtinRenderers[fullConfig.renderer || "tiers"];
    await applyRenderer(
      renderer,
      config,
      fullConfig,
      allSponsors,
      t
    );
  }
}
async function applyRenderer(renderer, config, renderOptions, sponsors, t = consola) {
  sponsors = [...sponsors];
  sponsors = await renderOptions.onBeforeRenderer?.(sponsors) || sponsors;
  const logPrefix = c.dim(`[${renderOptions.name}]`);
  const dir = resolve(process.cwd(), config.outputDir);
  await fsp.mkdir(dir, { recursive: true });
  if (renderOptions.formats?.includes("json")) {
    const path = join(dir, `${renderOptions.name}.json`);
    await fsp.writeFile(path, JSON.stringify(sponsors, null, 2));
    t.success(`${logPrefix} Wrote to ${r(path)}`);
  }
  if (renderOptions.filter)
    sponsors = sponsors.filter((s) => renderOptions.filter(s, sponsors) !== false);
  if (!renderOptions.includePrivate)
    sponsors = sponsors.filter((s) => s.privacyLevel !== "PRIVATE");
  t.info(`${logPrefix} Composing SVG...`);
  let svg = await renderer.renderSVG(renderOptions, sponsors);
  svg = await renderOptions.onSvgGenerated?.(svg) || svg;
  if (renderOptions.formats?.includes("svg")) {
    const path = join(dir, `${renderOptions.name}.svg`);
    await fsp.writeFile(path, svg, "utf-8");
    t.success(`${logPrefix} Wrote to ${r(path)}`);
  }
  if (renderOptions.formats?.includes("png")) {
    const path = join(dir, `${renderOptions.name}.png`);
    await fsp.writeFile(path, await svgToPng(svg));
    t.success(`${logPrefix} Wrote to ${r(path)}`);
  }
}
function normalizeReplacements(replaces) {
  const array = (Array.isArray(replaces) ? replaces : [replaces]).filter(notNullish);
  const entries = array.map((i) => {
    if (!i)
      return [];
    if (typeof i === "function")
      return [i];
    return Object.entries(i);
  }).flat();
  return entries;
}

const cli = yargs(process.argv.slice(2)).scriptName("sponsors-svg").usage("$0 [args]").version(version).strict().showHelpOnFail(false).alias("h", "help").alias("v", "version");
cli.command(
  "*",
  "Generate",
  (args) => args.option("width", {
    alias: "w",
    type: "number",
    default: 800
  }).option("fallbackAvatar", {
    type: "string",
    alias: "fallback"
  }).option("force", {
    alias: "f",
    default: false,
    type: "boolean"
  }).option("name", {
    type: "string"
  }).option("filter", {
    type: "string"
  }).option("outputDir", {
    type: "string",
    alias: ["o", "dir"]
  }).strict().help(),
  async (options) => {
    const config = options;
    if (options._[0])
      config.outputDir = options._[0];
    if (options.filter)
      config.filter = createFilterFromString(options.filter);
    await run(config);
  }
);
cli.help().parse();
function createFilterFromString(template) {
  const [_, op, value] = template.split(/([<>=]+)/);
  const num = Number.parseInt(value);
  if (op === "<")
    return (s) => s.monthlyDollars < num;
  if (op === "<=")
    return (s) => s.monthlyDollars <= num;
  if (op === ">")
    return (s) => s.monthlyDollars > num;
  if (op === ">=")
    return (s) => s.monthlyDollars >= num;
  throw new Error(`Unable to parse filter template ${template}`);
}
