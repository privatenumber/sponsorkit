import { loadConfig as loadConfig$1 } from 'unconfig';
import process from 'node:process';
import dotenv from 'dotenv';
import { Buffer } from 'node:buffer';
import { consola } from 'consola';
import { $fetch, ofetch } from 'ofetch';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import _normalizeUrl from 'normalize-url';

const none = {
  avatar: {
    size: 0
  },
  boxWidth: 0,
  boxHeight: 0,
  container: {
    sidePadding: 0
  }
};
const base = {
  avatar: {
    size: 40
  },
  boxWidth: 48,
  boxHeight: 48,
  container: {
    sidePadding: 30
  }
};
const xs = {
  avatar: {
    size: 25
  },
  boxWidth: 30,
  boxHeight: 30,
  container: {
    sidePadding: 30
  }
};
const small = {
  avatar: {
    size: 35
  },
  boxWidth: 38,
  boxHeight: 38,
  container: {
    sidePadding: 30
  }
};
const medium = {
  avatar: {
    size: 50
  },
  boxWidth: 80,
  boxHeight: 90,
  container: {
    sidePadding: 20
  },
  name: {
    maxLength: 10
  }
};
const large = {
  avatar: {
    size: 70
  },
  boxWidth: 95,
  boxHeight: 115,
  container: {
    sidePadding: 20
  },
  name: {
    maxLength: 16
  }
};
const xl = {
  avatar: {
    size: 90
  },
  boxWidth: 120,
  boxHeight: 130,
  container: {
    sidePadding: 20
  },
  name: {
    maxLength: 20
  }
};
const tierPresets = {
  none,
  xs,
  small,
  base,
  medium,
  large,
  xl
};
const presets = tierPresets;

const defaultTiers = [
  {
    title: "Past Sponsors",
    monthlyDollars: -1,
    preset: tierPresets.xs
  },
  {
    title: "Backers",
    preset: tierPresets.base
  },
  {
    title: "Sponsors",
    monthlyDollars: 10,
    preset: tierPresets.medium
  },
  {
    title: "Silver Sponsors",
    monthlyDollars: 50,
    preset: tierPresets.large
  },
  {
    title: "Gold Sponsors",
    monthlyDollars: 100,
    preset: tierPresets.xl
  }
];
const defaultInlineCSS = `
text {
  font-weight: 300;
  font-size: 14px;
  fill: #777777;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}
.sponsorkit-link {
  cursor: pointer;
}
.sponsorkit-tier-title {
  font-weight: 500;
  font-size: 20px;
}
`;
const defaultConfig = {
  width: 800,
  outputDir: "./sponsorkit",
  cacheFile: ".cache.json",
  formats: ["json", "svg", "png"],
  tiers: defaultTiers,
  name: "sponsors",
  includePrivate: false,
  svgInlineCSS: defaultInlineCSS
};

function getDeprecatedEnv(name, replacement) {
  const value = process.env[name];
  if (value)
    console.warn(`[sponsorkit] env.${name} is deprecated, use env.${replacement} instead`);
  return value;
}
function loadEnv() {
  dotenv.config();
  const config = {
    github: {
      login: process.env.SPONSORKIT_GITHUB_LOGIN || process.env.GITHUB_LOGIN || getDeprecatedEnv("SPONSORKIT_LOGIN", "SPONSORKIT_GITHUB_LOGIN"),
      token: process.env.SPONSORKIT_GITHUB_TOKEN || process.env.GITHUB_TOKEN || getDeprecatedEnv("SPONSORKIT_TOKEN", "SPONSORKIT_GITHUB_TOKEN"),
      type: process.env.SPONSORKIT_GITHUB_TYPE || process.env.GITHUB_TYPE
    },
    patreon: {
      token: process.env.SPONSORKIT_PATREON_TOKEN || process.env.PATREON_TOKEN
    },
    opencollective: {
      key: process.env.SPONSORKIT_OPENCOLLECTIVE_KEY || process.env.OPENCOLLECTIVE_KEY,
      id: process.env.SPONSORKIT_OPENCOLLECTIVE_ID || process.env.OPENCOLLECTIVE_ID,
      slug: process.env.SPONSORKIT_OPENCOLLECTIVE_SLUG || process.env.OPENCOLLECTIVE_SLUG,
      githubHandle: process.env.SPONSORKIT_OPENCOLLECTIVE_GH_HANDLE || process.env.OPENCOLLECTIVE_GH_HANDLE,
      type: process.env.SPONSORKIT_OPENCOLLECTIVE_TYPE || process.env.OPENCOLLECTIVE_TYPE
    },
    afdian: {
      userId: process.env.SPONSORKIT_AFDIAN_USER_ID || process.env.AFDIAN_USER_ID,
      token: process.env.SPONSORKIT_AFDIAN_TOKEN || process.env.AFDIAN_TOKEN,
      exechangeRate: Number.parseFloat(process.env.SPONSORKIT_AFDIAN_EXECHANGERATE || process.env.AFDIAN_EXECHANGERATE || "0") || void 0
    },
    polar: {
      token: process.env.SPONSORKIT_POLAR_TOKEN || process.env.POLAR_TOKEN,
      organization: process.env.SPONSORKIT_POLAR_ORGANIZATION || process.env.POLAR_ORGANIZATION
    },
    outputDir: process.env.SPONSORKIT_DIR
  };
  return JSON.parse(JSON.stringify(config));
}

const version = "0.15.5";

async function fetchImage(url) {
  const arrayBuffer = await $fetch(url, {
    responseType: "arrayBuffer",
    headers: {
      "User-Agent": `Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36 Sponsorkit/${version}`
    }
  });
  return Buffer.from(arrayBuffer);
}
async function resolveAvatars(ships, getFallbackAvatar, t = consola) {
  const fallbackAvatar = await (() => {
    if (typeof getFallbackAvatar === "string") {
      return fetchImage(getFallbackAvatar);
    }
    if (getFallbackAvatar)
      return getFallbackAvatar;
  })();
  const pLimit = await import('p-limit').then((r) => r.default);
  const limit = pLimit(15);
  return Promise.all(ships.map((ship) => limit(async () => {
    if (ship.privacyLevel === "PRIVATE" || !ship.sponsor.avatarUrl) {
      ship.sponsor.avatarBuffer = fallbackAvatar;
      return;
    }
    const pngBuffer = await fetchImage(ship.sponsor.avatarUrl).catch((e) => {
      t.error(`Failed to fetch avatar for ${ship.sponsor.login || ship.sponsor.name} [${ship.sponsor.avatarUrl}]`);
      t.error(e);
      if (fallbackAvatar)
        return fallbackAvatar;
      throw e;
    });
    if (pngBuffer) {
      ship.sponsor.avatarBuffer = await resizeImage(pngBuffer, 120, "webp");
    }
  })));
}
const cache = /* @__PURE__ */ new Map();
async function resizeImage(image, size = 100, format) {
  const cacheKey = `${size}:${format}`;
  if (cache.has(image)) {
    const cacheHit = cache.get(image).get(cacheKey);
    if (cacheHit) {
      return cacheHit;
    }
  }
  let processing = sharp(image).resize(size, size, { fit: sharp.fit.cover });
  processing = format === "webp" ? processing.webp() : processing.png({ quality: 80, compressionLevel: 8 });
  const result = await processing.toBuffer();
  if (!cache.has(image)) {
    cache.set(image, /* @__PURE__ */ new Map());
  }
  cache.get(image).set(cacheKey, result);
  return result;
}
function svgToPng(svg) {
  return sharp(Buffer.from(svg), { density: 150 }).png({ quality: 90 }).toBuffer();
}
function svgToWebp(svg) {
  return sharp(Buffer.from(svg), { density: 150 }).webp().toBuffer();
}

const fallback = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 135.47 135.47">
    <path fill="#2d333b" stroke="#000" stroke-linejoin="round" stroke-width=".32" d="M.16.16h135.15v135.15H.16z" paint-order="stroke markers fill"/>
    <path fill="#636e7b" fill-rule="evenodd" d="M81.85 53.56a14.13 14.13 0 1 1-28.25 0 14.13 14.13 0 0 1 28.25 0zm.35 17.36a22.6 22.6 0 1 0-28.95 0 33.92 33.92 0 0 0-19.38 29.05 4.24 4.24 0 0 0 8.46.4 25.43 25.43 0 0 1 50.8 0 4.24 4.24 0 1 0 8.46-.4 33.93 33.93 0 0 0-19.4-29.05z"/>
</svg>
`;
const FALLBACK_AVATAR = svgToPng(fallback);

function defineConfig(config) {
  return config;
}
async function loadConfig(inlineConfig = {}) {
  const env = loadEnv();
  const { config = {} } = await loadConfig$1({
    sources: [
      {
        files: "sponsor.config"
      },
      {
        files: "sponsorkit.config"
      }
    ],
    merge: true
  });
  const hasNegativeTier = !!config.tiers?.find((tier) => tier && tier.monthlyDollars <= 0);
  const resolved = {
    fallbackAvatar: FALLBACK_AVATAR,
    includePastSponsors: hasNegativeTier,
    ...defaultConfig,
    ...env,
    ...config,
    ...inlineConfig,
    github: {
      ...env.github,
      ...config.github,
      ...inlineConfig.github
    },
    patreon: {
      ...env.patreon,
      ...config.patreon,
      ...inlineConfig.patreon
    },
    opencollective: {
      ...env.opencollective,
      ...config.opencollective,
      ...inlineConfig.opencollective
    },
    afdian: {
      ...env.afdian,
      ...config.afdian,
      ...inlineConfig.afdian
    }
  };
  return resolved;
}
function partitionTiers(sponsors, tiers, includePastSponsors) {
  const tierMappings = tiers.map((tier) => ({
    monthlyDollars: tier.monthlyDollars ?? 0,
    tier,
    sponsors: []
  }));
  tierMappings.sort((a, b) => b.monthlyDollars - a.monthlyDollars);
  const finalSponsors = tierMappings.filter((i) => i.monthlyDollars === 0);
  if (finalSponsors.length !== 1)
    throw new Error(`There should be exactly one tier with no \`monthlyDollars\`, but got ${finalSponsors.length}`);
  sponsors.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).filter((s) => s.monthlyDollars > 0 || includePastSponsors).forEach((sponsor) => {
    const tier = tierMappings.find((t) => sponsor.monthlyDollars >= t.monthlyDollars) ?? tierMappings[0];
    tier.sponsors.push(sponsor);
  });
  return tierMappings;
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
let id = 0;
function genSvgImage(x, y, size, radius, base64Image, imageFormat) {
  const cropId = `c${id++}`;
  return `
  <clipPath id="${cropId}">
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * radius}" ry="${size * radius}" />
  </clipPath>
  <image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/${imageFormat};base64,${base64Image}" clip-path="url(#${cropId})"/>`;
}
async function generateBadge(x, y, sponsor, preset, radius, imageFormat) {
  const { login } = sponsor;
  let name = (sponsor.name || sponsor.login).trim();
  const url = sponsor.websiteUrl || sponsor.linkUrl;
  if (preset.name && preset.name.maxLength && name.length > preset.name.maxLength) {
    if (name.includes(" "))
      name = name.split(" ")[0];
    else
      name = `${name.slice(0, preset.name.maxLength - 3)}...`;
  }
  const { size } = preset.avatar;
  let avatar = sponsor.avatarBuffer;
  if (size < 50) {
    avatar = await resizeImage(avatar, 50, imageFormat);
  } else if (size < 80) {
    avatar = await resizeImage(avatar, 80, imageFormat);
  } else if (imageFormat === "png") {
    avatar = await resizeImage(avatar, 120, imageFormat);
  }
  const avatarBase64 = avatar.toString("base64");
  return `<a ${url ? `href="${url}" ` : ""}class="${preset.classes || "sponsorkit-link"}" target="_blank" id="${login}">
  ${preset.name ? `<text x="${x + size / 2}" y="${y + size + 18}" text-anchor="middle" class="${preset.name.classes || "sponsorkit-name"}" fill="${preset.name.color || "currentColor"}">${encodeHtmlEntities(name)}</text>
  ` : ""}${genSvgImage(x, y, size, radius, avatarBase64, imageFormat)}
</a>`.trim();
}
class SvgComposer {
  constructor(config) {
    this.config = config;
    __publicField(this, "height", 0);
    __publicField(this, "body", "");
  }
  addSpan(height = 0) {
    this.height += height;
    return this;
  }
  addTitle(text, classes = "sponsorkit-tier-title") {
    return this.addText(text, classes);
  }
  addText(text, classes = "text") {
    this.body += `<text x="${this.config.width / 2}" y="${this.height}" text-anchor="middle" class="${classes}">${text}</text>`;
    this.height += 20;
    return this;
  }
  addRaw(svg) {
    this.body += svg;
    return this;
  }
  async addSponsorLine(sponsors, preset) {
    const offsetX = (this.config.width - sponsors.length * preset.boxWidth) / 2 + (preset.boxWidth - preset.avatar.size) / 2;
    const sponsorLine = await Promise.all(sponsors.map(async (s, i) => {
      const x = offsetX + preset.boxWidth * i;
      const y = this.height;
      const radius = s.sponsor.type === "Organization" ? 0.1 : 0.5;
      return await generateBadge(x, y, s.sponsor, preset, radius, this.config.imageFormat);
    }));
    this.body += sponsorLine.join("\n");
    this.height += preset.boxHeight;
  }
  async addSponsorGrid(sponsors, preset) {
    const perLine = Math.floor((this.config.width - (preset.container?.sidePadding || 0) * 2) / preset.boxWidth);
    for (let i = 0; i < Math.ceil(sponsors.length / perLine); i++) {
      await this.addSponsorLine(sponsors.slice(i * perLine, (i + 1) * perLine), preset);
    }
    return this;
  }
  generateSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${this.config.width} ${this.height}" width="${this.config.width}" height="${this.height}">
<!-- Generated by https://github.com/antfu/sponsorskit -->
<style>${this.config.svgInlineCSS}</style>
${this.body}
</svg>
`;
  }
}
function encodeHtmlEntities(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const AfdianProvider = {
  name: "afdian",
  fetchSponsors(config) {
    return fetchAfdianSponsors(config.afdian);
  }
};
async function fetchAfdianSponsors(options = {}) {
  const {
    userId,
    token,
    exechangeRate = 6.5,
    includePurchases = true,
    purchaseEffectivity = 30
  } = options;
  if (!userId || !token)
    throw new Error("Afdian id and token are required");
  const sponsors = [];
  const sponsorshipApi = "https://afdian.com/api/open/query-sponsor";
  let page = 1;
  let pages = 1;
  do {
    const params = JSON.stringify({ page });
    const ts = Math.round(+ new Date() / 1e3);
    const sign = md5(token, params, ts, userId);
    const sponsorshipData = await $fetch(sponsorshipApi, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      responseType: "json",
      body: {
        user_id: userId,
        params,
        ts,
        sign
      }
    });
    page += 1;
    if (sponsorshipData?.ec !== 200)
      break;
    pages = sponsorshipData.data.total_page;
    if (!includePurchases) {
      sponsorshipData.data.list = sponsorshipData.data.list.filter((sponsor) => {
        const current = sponsor.current_plan;
        if (!current || current.product_type === 0)
          return true;
        return false;
      });
    }
    if (purchaseEffectivity > 0) {
      sponsorshipData.data.list = sponsorshipData.data.list.map((sponsor) => {
        const current = sponsor.current_plan;
        if (!current || current.product_type === 0)
          return sponsor;
        const expireTime = current.update_time + purchaseEffectivity * 24 * 3600;
        sponsor.current_plan.expire_time = expireTime;
        return sponsor;
      });
    }
    sponsors.push(...sponsorshipData.data.list);
  } while (page <= pages);
  const processed = sponsors.map((raw) => {
    const current = raw.current_plan;
    const expireTime = current?.expire_time;
    const isExpired = expireTime ? expireTime < Date.now() / 1e3 : true;
    let name = raw.user.name;
    if (name.startsWith("\u7231\u53D1\u7535\u7528\u6237_"))
      name = raw.user.user_id.slice(0, 5);
    const avatarUrl = raw.user.avatar;
    return {
      sponsor: {
        type: "User",
        login: raw.user.user_id,
        name,
        avatarUrl,
        linkUrl: `https://afdian.com/u/${raw.user.user_id}`
      },
      // all_sum_amount is based on cny
      monthlyDollars: isExpired ? -1 : Number.parseFloat(raw.all_sum_amount) / exechangeRate,
      privacyLevel: "PUBLIC",
      tierName: "Afdian",
      createdAt: new Date(raw.first_pay_time * 1e3).toISOString(),
      expireAt: expireTime ? new Date(expireTime * 1e3).toISOString() : void 0,
      // empty string means no plan, consider as one time sponsor
      isOneTime: Boolean(raw.current_plan?.name),
      provider: "afdian",
      raw
    };
  });
  return processed;
}
function md5(token, params, ts, userId) {
  return createHash("md5").update(`${token}params${params}ts${ts}user_id${userId}`).digest("hex");
}

function normalizeUrl(url) {
  if (!url)
    return void 0;
  return _normalizeUrl(url, {
    defaultProtocol: "https"
  });
}

function getMonthDifference(startDate, endDate) {
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}
function getCurrentMonthTier(dateNow, sponsorDate, tiers, monthlyDollars) {
  let currentMonths = 0;
  for (const tier of tiers) {
    const monthsAtTier = Math.floor(monthlyDollars / tier.monthlyDollars);
    if (monthsAtTier === 0) {
      continue;
    }
    if (currentMonths + monthsAtTier > getMonthDifference(sponsorDate, dateNow)) {
      return tier.monthlyDollars;
    }
    monthlyDollars -= monthsAtTier * tier.monthlyDollars;
    currentMonths += monthsAtTier;
  }
  return -1;
}
const API$1 = "https://api.github.com/graphql";
const graphql$1 = String.raw;
const GitHubProvider = {
  name: "github",
  fetchSponsors(config) {
    return fetchGitHubSponsors(
      config.github?.token || config.token,
      config.github?.login || config.login,
      config.github?.type || "user",
      config
    );
  }
};
async function fetchGitHubSponsors(token, login, type, config) {
  if (!token)
    throw new Error("GitHub token is required");
  if (!login)
    throw new Error("GitHub login is required");
  if (!["user", "organization"].includes(type))
    throw new Error("GitHub type must be either `user` or `organization`");
  const sponsors = [];
  let cursor;
  const tiers = config.tiers?.filter((tier) => tier.monthlyDollars && tier.monthlyDollars > 0).sort((a, b) => b.monthlyDollars - a.monthlyDollars);
  do {
    const query = makeQuery(login, type, !config.includePastSponsors, cursor);
    const data = await $fetch(API$1, {
      method: "POST",
      body: { query },
      headers: {
        "Authorization": `bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    if (!data)
      throw new Error(`Get no response on requesting ${API$1}`);
    else if (data.errors?.[0]?.type === "INSUFFICIENT_SCOPES")
      throw new Error("Token is missing the `read:user` and/or `read:org` scopes");
    else if (data.errors?.length)
      throw new Error(`GitHub API error:
${JSON.stringify(data.errors, null, 2)}`);
    sponsors.push(
      ...data.data[type].sponsorshipsAsMaintainer.nodes || []
    );
    if (data.data[type].sponsorshipsAsMaintainer.pageInfo.hasNextPage)
      cursor = data.data[type].sponsorshipsAsMaintainer.pageInfo.endCursor;
    else
      cursor = void 0;
  } while (cursor);
  const dateNow = /* @__PURE__ */ new Date();
  const processed = sponsors.filter((raw) => !!raw.tier).map((raw) => {
    let monthlyDollars = raw.tier.monthlyPriceInDollars;
    if (!raw.isActive) {
      if (tiers && raw.tier.isOneTime && config.prorateOnetime) {
        monthlyDollars = getCurrentMonthTier(
          dateNow,
          new Date(raw.createdAt),
          tiers,
          monthlyDollars
        );
      } else {
        monthlyDollars = -1;
      }
    }
    return {
      sponsor: {
        ...raw.sponsorEntity,
        websiteUrl: normalizeUrl(raw.sponsorEntity.websiteUrl),
        linkUrl: `https://github.com/${raw.sponsorEntity.login}`,
        __typename: void 0,
        type: raw.sponsorEntity.__typename
      },
      isOneTime: raw.tier.isOneTime,
      monthlyDollars,
      privacyLevel: raw.privacyLevel,
      tierName: raw.tier.name,
      createdAt: raw.createdAt
    };
  });
  return processed;
}
function makeQuery(login, type, activeOnly = true, cursor) {
  return graphql$1`{
  ${type}(login: "${login}") {
    sponsorshipsAsMaintainer(activeOnly: ${Boolean(activeOnly)}, first: 100${cursor ? ` after: "${cursor}"` : ""}) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        createdAt
        privacyLevel
        isActive
        tier {
          name
          isOneTime
          monthlyPriceInCents
          monthlyPriceInDollars
        }
        sponsorEntity {
          __typename
          ...on Organization {
            login
            name
            avatarUrl
            websiteUrl
          }
          ...on User {
            login
            name
            avatarUrl
            websiteUrl
          }
        }
      }
    }
  }
}`;
}

const OpenCollectiveProvider = {
  name: "opencollective",
  fetchSponsors(config) {
    return fetchOpenCollectiveSponsors(
      config.opencollective?.key,
      config.opencollective?.id,
      config.opencollective?.slug,
      config.opencollective?.githubHandle,
      config.includePastSponsors
    );
  }
};
const API = "https://api.opencollective.com/graphql/v2/";
const graphql = String.raw;
async function fetchOpenCollectiveSponsors(key, id, slug, githubHandle, includePastSponsors) {
  if (!key)
    throw new Error("OpenCollective api key is required");
  if (!slug && !id && !githubHandle)
    throw new Error("OpenCollective collective id or slug or GitHub handle is required");
  const sponsors = [];
  const monthlyTransactions = [];
  let offset;
  offset = 0;
  do {
    const query = makeSubscriptionsQuery(id, slug, githubHandle, offset, !includePastSponsors);
    const data = await $fetch(API, {
      method: "POST",
      body: { query },
      headers: {
        "Api-Key": `${key}`,
        "Content-Type": "application/json"
      }
    });
    const nodes = data.data.account.orders.nodes;
    const totalCount = data.data.account.orders.totalCount;
    sponsors.push(...nodes || []);
    if (nodes.length !== 0) {
      if (totalCount > offset + nodes.length)
        offset += nodes.length;
      else
        offset = void 0;
    } else {
      offset = void 0;
    }
  } while (offset);
  offset = 0;
  do {
    const now =  new Date();
    const dateFrom = includePastSponsors ? void 0 : new Date(now.getFullYear(), now.getMonth(), 1);
    const query = makeTransactionsQuery(id, slug, githubHandle, offset, dateFrom);
    const data = await $fetch(API, {
      method: "POST",
      body: { query },
      headers: {
        "Api-Key": `${key}`,
        "Content-Type": "application/json"
      }
    });
    const nodes = data.data.account.transactions.nodes;
    const totalCount = data.data.account.transactions.totalCount;
    monthlyTransactions.push(...nodes || []);
    if (nodes.length !== 0) {
      if (totalCount > offset + nodes.length)
        offset += nodes.length;
      else
        offset = void 0;
    } else {
      offset = void 0;
    }
  } while (offset);
  const sponsorships = sponsors.map(createSponsorFromOrder).filter((sponsorship) => sponsorship !== null);
  const monthlySponsorships = monthlyTransactions.map((t) => createSponsorFromTransaction(t, sponsorships.map((i) => i[1].raw.id))).filter((sponsorship) => sponsorship !== null && sponsorship !== void 0);
  const transactionsBySponsorId = monthlySponsorships.reduce((map, [id2, sponsor]) => {
    const existingSponsor = map.get(id2);
    if (existingSponsor) {
      const createdAt = new Date(sponsor.createdAt);
      const existingSponsorCreatedAt = new Date(existingSponsor.createdAt);
      if (createdAt >= existingSponsorCreatedAt)
        map.set(id2, sponsor);
      else if (new Date(existingSponsorCreatedAt.getFullYear(), existingSponsorCreatedAt.getMonth(), 1) === new Date(createdAt.getFullYear(), createdAt.getMonth(), 1))
        existingSponsor.monthlyDollars += sponsor.monthlyDollars;
    } else {
      map.set(id2, sponsor);
    }
    return map;
  }, /* @__PURE__ */ new Map());
  const processed = sponsorships.reduce((map, [id2, sponsor]) => {
    const existingSponsor = map.get(id2);
    if (existingSponsor) {
      const createdAt = new Date(sponsor.createdAt);
      const existingSponsorCreatedAt = new Date(existingSponsor.createdAt);
      if (createdAt >= existingSponsorCreatedAt)
        map.set(id2, sponsor);
    } else {
      map.set(id2, sponsor);
    }
    return map;
  }, /* @__PURE__ */ new Map());
  const result = Array.from(processed.values()).concat(Array.from(transactionsBySponsorId.values()));
  return result;
}
function createSponsorFromOrder(order) {
  const slug = order.fromAccount.slug;
  if (slug === "github-sponsors")
    return void 0;
  let monthlyDollars = order.amount.value;
  if (order.status !== "ACTIVE")
    monthlyDollars = -1;
  else if (order.frequency === "MONTHLY")
    monthlyDollars = order.amount.value;
  else if (order.frequency === "YEARLY")
    monthlyDollars = order.amount.value / 12;
  else if (order.frequency === "ONETIME")
    monthlyDollars = order.amount.value;
  const sponsor = {
    sponsor: {
      name: order.fromAccount.name,
      type: getAccountType(order.fromAccount.type),
      login: slug,
      avatarUrl: order.fromAccount.imageUrl,
      websiteUrl: normalizeUrl(getBestUrl(order.fromAccount.socialLinks)),
      linkUrl: `https://opencollective.com/${slug}`,
      socialLogins: getSocialLogins(order.fromAccount.socialLinks, slug)
    },
    isOneTime: order.frequency === "ONETIME",
    monthlyDollars,
    privacyLevel: order.fromAccount.isIncognito ? "PRIVATE" : "PUBLIC",
    tierName: order.tier?.name,
    createdAt: order.frequency === "ONETIME" ? order.createdAt : order.order?.createdAt,
    raw: order
  };
  return [order.fromAccount.id, sponsor];
}
function createSponsorFromTransaction(transaction, excludeOrders) {
  const slug = transaction.fromAccount.slug;
  if (slug === "github-sponsors")
    return void 0;
  if (excludeOrders.includes(transaction.order?.id))
    return void 0;
  let monthlyDollars = transaction.amount.value;
  if (transaction.order?.status !== "ACTIVE") {
    const firstDayOfCurrentMonth = new Date((/* @__PURE__ */ new Date()).getUTCFullYear(), (/* @__PURE__ */ new Date()).getUTCMonth(), 1);
    if (new Date(transaction.createdAt) < firstDayOfCurrentMonth)
      monthlyDollars = -1;
  } else if (transaction.order?.frequency === "MONTHLY") {
    monthlyDollars = transaction.order?.amount.value;
  } else if (transaction.order?.frequency === "YEARLY") {
    monthlyDollars = transaction.order?.amount.value / 12;
  }
  const sponsor = {
    sponsor: {
      name: transaction.fromAccount.name,
      type: getAccountType(transaction.fromAccount.type),
      login: slug,
      avatarUrl: transaction.fromAccount.imageUrl,
      websiteUrl: normalizeUrl(getBestUrl(transaction.fromAccount.socialLinks)),
      linkUrl: `https://opencollective.com/${slug}`,
      socialLogins: getSocialLogins(transaction.fromAccount.socialLinks, slug)
    },
    isOneTime: transaction.order?.frequency === "ONETIME",
    monthlyDollars,
    privacyLevel: transaction.fromAccount.isIncognito ? "PRIVATE" : "PUBLIC",
    tierName: transaction.tier?.name,
    createdAt: transaction.order?.frequency === "ONETIME" ? transaction.createdAt : transaction.order?.createdAt,
    raw: transaction
  };
  return [transaction.fromAccount.id, sponsor];
}
function makeAccountQueryPartial(id, slug, githubHandle) {
  if (id)
    return `id: "${id}"`;
  else if (slug)
    return `slug: "${slug}"`;
  else if (githubHandle)
    return `githubHandle: "${githubHandle}"`;
  else
    throw new Error("OpenCollective collective id or slug or GitHub handle is required");
}
function makeTransactionsQuery(id, slug, githubHandle, offset, dateFrom, dateTo) {
  const accountQueryPartial = makeAccountQueryPartial(id, slug, githubHandle);
  const dateFromParam = dateFrom ? `, dateFrom: "${dateFrom.toISOString()}"` : "";
  const dateToParam = dateTo ? `, dateTo: "${dateTo.toISOString()}"` : "";
  return graphql`{
    account(${accountQueryPartial}) {
      transactions(limit: 1000, offset:${offset}, type: CREDIT ${dateFromParam} ${dateToParam}) {
        offset
        limit
        totalCount
        nodes {
          type
          kind
          id
          order {
            id
            status
            frequency
            tier {
              name
            }
            amount {
              value
            }
          }
          createdAt
          amount {
            value
          }
          fromAccount {
            name
            id
            slug
            type
            githubHandle
            socialLinks {
              url
              type
            }
            isIncognito
            imageUrl(height: 460, format: png)
          }
        }
      }
    }
  }`;
}
function makeSubscriptionsQuery(id, slug, githubHandle, offset, activeOnly) {
  const activeOrNot = activeOnly ? "onlyActiveSubscriptions: true" : "onlySubscriptions: true";
  return graphql`{
    account(${makeAccountQueryPartial(id, slug, githubHandle)}) {
      orders(limit: 1000, offset:${offset}, ${activeOrNot}, filter: INCOMING) {
        nodes {
          id
          createdAt
          frequency
          status
          tier {
            name
          }
          amount {
            value
          }
          totalDonations {
            value
          }
          createdAt
          fromAccount {
            name
            id
            slug
            type
            socialLinks {
              url
              type
            }
            isIncognito
            imageUrl(height: 460, format: png)
          }
        }
      }
    }
  }`;
}
function getAccountType(type) {
  switch (type) {
    case "INDIVIDUAL":
      return "User";
    case "ORGANIZATION":
    case "COLLECTIVE":
    case "FUND":
    case "PROJECT":
    case "EVENT":
    case "VENDOR":
    case "BOT":
      return "Organization";
    default:
      throw new Error(`Unknown account type: ${type}`);
  }
}
function getBestUrl(socialLinks) {
  const urls = socialLinks.filter((i) => i.type === "WEBSITE" || i.type === "GITHUB" || i.type === "GITLAB" || i.type === "TWITTER" || i.type === "FACEBOOK" || i.type === "YOUTUBE" || i.type === "INSTAGRAM" || i.type === "LINKEDIN" || i.type === "DISCORD" || i.type === "TUMBLR").map((i) => i.url);
  return urls[0];
}
function getSocialLogins(socialLinks = [], opencollectiveLogin) {
  const socialLogins = {};
  for (const link of socialLinks) {
    if (link.type === "GITHUB") {
      const login = link.url.match(/github\.com\/([^/]*)/)?.[1];
      if (login)
        socialLogins.github = login;
    }
  }
  if (opencollectiveLogin)
    socialLogins.opencollective = opencollectiveLogin;
  return socialLogins;
}

const PatreonProvider = {
  name: "patreon",
  fetchSponsors(config) {
    return fetchPatreonSponsors(config.patreon?.token || config.token);
  }
};
async function fetchPatreonSponsors(token) {
  if (!token)
    throw new Error("Patreon token is required");
  const userData = await $fetch(
    "https://www.patreon.com/api/oauth2/api/current_user/campaigns?include=null",
    {
      method: "GET",
      headers: {
        "Authorization": `bearer ${token}`,
        "Content-Type": "application/json"
      },
      responseType: "json"
    }
  );
  const userCampaignId = userData.data[0].id;
  const sponsors = [];
  let sponsorshipApi = `https://www.patreon.com/api/oauth2/v2/campaigns/${userCampaignId}/members?include=user&fields%5Bmember%5D=currently_entitled_amount_cents,patron_status,pledge_relationship_start,lifetime_support_cents&fields%5Buser%5D=image_url,url,first_name,full_name&page%5Bcount%5D=100`;
  do {
    const sponsorshipData = await $fetch(sponsorshipApi, {
      method: "GET",
      headers: {
        "Authorization": `bearer ${token}`,
        "Content-Type": "application/json"
      },
      responseType: "json"
    });
    sponsors.push(
      ...sponsorshipData.data.filter((membership) => membership.attributes.patron_status !== null).map((membership) => ({
        membership,
        patron: sponsorshipData.included.find(
          (v) => v.id === membership.relationships.user.data.id
        )
      }))
    );
    sponsorshipApi = sponsorshipData.links?.next;
  } while (sponsorshipApi);
  const processed = sponsors.map(
    (raw) => ({
      sponsor: {
        avatarUrl: raw.patron.attributes.image_url,
        login: raw.patron.attributes.first_name,
        name: raw.patron.attributes.full_name,
        type: "User",
        // Patreon only support user
        linkUrl: raw.patron.attributes.url
      },
      isOneTime: false,
      // One-time pledges not supported
      // The "former_patron" and "declined_patron" both is past sponsors
      monthlyDollars: ["former_patron", "declined_patron"].includes(raw.membership.attributes.patron_status) ? -1 : Math.floor(raw.membership.attributes.currently_entitled_amount_cents / 100),
      privacyLevel: "PUBLIC",
      // Patreon is all public
      tierName: "Patreon",
      createdAt: raw.membership.attributes.pledge_relationship_start
    })
  );
  return processed;
}

const PolarProvider = {
  name: "polar",
  fetchSponsors(config) {
    return fetchPolarSponsors(config.polar?.token || config.token, config.polar?.organization);
  }
};
async function fetchPolarSponsors(token, organization) {
  if (!token)
    throw new Error("Polar token is required");
  if (!organization)
    throw new Error("Polar organization is required");
  const apiFetch = ofetch.create({
    baseURL: "https://api.polar.sh/v1",
    headers: { Authorization: `Bearer ${token}` }
  });
  const org = await apiFetch("/organizations", {
    params: {
      slug: organization
    }
  });
  const orgId = org.items?.[0]?.id;
  if (!orgId)
    throw new Error(`Polar organization "${organization}" not found`);
  let page = 1;
  let pages = 1;
  const subscriptions = [];
  do {
    const params = {
      organization_id: orgId,
      page
    };
    const subs = await apiFetch("/subscriptions", { params });
    subscriptions.push(...subs.items);
    pages = subs.pagination.max_page;
    page += 1;
  } while (page <= pages);
  return subscriptions.filter((sub) => !!sub.price).map((sub) => {
    const isActive = sub.status === "active";
    return {
      sponsor: {
        name: sub.user.public_name,
        avatarUrl: sub.user.avatar_url,
        login: sub.user.github_username,
        type: sub.product.type === "individual" ? "User" : "Organization",
        socialLogins: {
          github: sub.user.github_username
        }
      },
      isOneTime: false,
      provider: "polar",
      privacyLevel: "PUBLIC",
      createdAt: new Date(sub.created_at).toISOString(),
      tierName: isActive ? sub.product.name : void 0,
      monthlyDollars: isActive ? sub.price.price_amount / 100 : -1
    };
  });
}

const ProvidersMap = {
  github: GitHubProvider,
  patreon: PatreonProvider,
  opencollective: OpenCollectiveProvider,
  afdian: AfdianProvider,
  polar: PolarProvider
};
function guessProviders(config) {
  const items = [];
  if (config.github && config.github.login)
    items.push("github");
  if (config.patreon && config.patreon.token)
    items.push("patreon");
  if (config.opencollective && (config.opencollective.id || config.opencollective.slug || config.opencollective.githubHandle))
    items.push("opencollective");
  if (config.afdian && config.afdian.userId && config.afdian.token)
    items.push("afdian");
  if (config.polar && config.polar.token)
    items.push("polar");
  if (!items.length)
    items.push("github");
  return items;
}
function resolveProviders(names) {
  return Array.from(new Set(names)).map((i) => {
    if (typeof i === "string") {
      const provider = ProvidersMap[i];
      if (!provider)
        throw new Error(`Unknown provider: ${i}`);
      return provider;
    }
    return i;
  });
}
async function fetchSponsors(config) {
  const providers = resolveProviders(guessProviders(config));
  const sponsorships = await Promise.all(
    providers.map((provider) => provider.fetchSponsors(config))
  );
  return sponsorships.flat(1);
}

const outputFormats = ["svg", "png", "webp", "json"];

export { FALLBACK_AVATAR as F, GitHubProvider as G, ProvidersMap as P, SvgComposer as S, guessProviders as a, resolveAvatars as b, svgToWebp as c, defineConfig as d, defaultTiers as e, defaultInlineCSS as f, generateBadge as g, defaultConfig as h, presets as i, resizeImage as j, genSvgImage as k, loadConfig as l, fetchSponsors as m, fetchGitHubSponsors as n, outputFormats as o, partitionTiers as p, makeQuery as q, resolveProviders as r, svgToPng as s, tierPresets as t, version as v };
