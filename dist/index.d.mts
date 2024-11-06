import { Buffer as Buffer$1 } from 'node:buffer';
import * as consola from 'consola';

declare function genSvgImage(x: number, y: number, size: number, radius: number, base64Image: string, imageFormat: ImageFormat): string;
declare function generateBadge(x: number, y: number, sponsor: Sponsor, preset: BadgePreset, radius: number, imageFormat: ImageFormat): Promise<string>;
declare class SvgComposer {
    readonly config: Required<SponsorkitRenderOptions>;
    height: number;
    body: string;
    constructor(config: Required<SponsorkitRenderOptions>);
    addSpan(height?: number): this;
    addTitle(text: string, classes?: string): this;
    addText(text: string, classes?: string): this;
    addRaw(svg: string): this;
    addSponsorLine(sponsors: Sponsorship[], preset: BadgePreset): Promise<void>;
    addSponsorGrid(sponsors: Sponsorship[], preset: BadgePreset): Promise<this>;
    generateSvg(): string;
}

type ImageFormat = 'png' | 'webp';
interface BadgePreset {
    boxWidth: number;
    boxHeight: number;
    avatar: {
        size: number;
        classes?: string;
    };
    name?: false | {
        color?: string;
        classes?: string;
        maxLength?: number;
    };
    container?: {
        sidePadding?: number;
    };
    classes?: string;
}
interface TierPartition {
    monthlyDollars: number;
    tier: Tier;
    sponsors: Sponsorship[];
}
interface Provider {
    name: string;
    fetchSponsors: (config: SponsorkitConfig) => Promise<Sponsorship[]>;
}
interface Sponsor {
    type: 'User' | 'Organization';
    login: string;
    name: string;
    avatarUrl: string;
    avatarBuffer?: Buffer$1;
    websiteUrl?: string;
    linkUrl?: string;
    /**
     * Map of logins of other social accounts
     *
     * @example
     * ```json
     * {
     *   'github': 'antfu',
     *   'opencollective': 'antfu',
     * }
     * ```
     *
     * This would allow us to merge sponsors from different platforms.
     */
    socialLogins?: Record<string, string>;
}
interface Sponsorship {
    sponsor: Sponsor;
    monthlyDollars: number;
    privacyLevel?: 'PUBLIC' | 'PRIVATE';
    tierName?: string;
    createdAt?: string;
    expireAt?: string;
    isOneTime?: boolean;
    provider?: ProviderName | string;
    /**
     * Raw data from provider
     */
    raw?: any;
}
declare const outputFormats: readonly ["svg", "png", "webp", "json"];
type OutputFormat = typeof outputFormats[number];
type ProviderName = 'github' | 'patreon' | 'opencollective' | 'afdian' | 'polar';
type GitHubAccountType = 'user' | 'organization';
interface ProvidersConfig {
    github?: {
        /**
         * User id of your GitHub account.
         *
         * Will read from `SPONSORKIT_GITHUB_LOGIN` environment variable if not set.
         */
        login?: string;
        /**
         * GitHub Token that have access to your sponsorships.
         *
         * Will read from `SPONSORKIT_GITHUB_TOKEN` environment variable if not set.
         *
         * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
         */
        token?: string;
        /**
         * The account type for sponsorships.
         *
         * Possible values are `user`(default) and `organization`.
         * Will read from `SPONSORKIT_GITHUB_TYPE` environment variable if not set.
         */
        type?: GitHubAccountType;
    };
    patreon?: {
        /**
         * Patreon Token that have access to your sponsorships.
         *
         * Will read from `SPONSORKIT_PATREON_TOKEN` environment variable if not set.
         *
         * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
         */
        token?: string;
    };
    opencollective?: {
        /**
         * Api key of your OpenCollective account.
         *
         * Will read from `SPONSORKIT_OPENCOLLECTIVE_KEY` environment variable if not set.
         *
         * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
         */
        key?: string;
        /**
         * The id of your account.
         *
         * Will read from `SPONSORKIT_OPENCOLLECTIVE_ID` environment variable if not set.
         */
        id?: string;
        /**
         * The slug of your account.
         *
         * Will read from `SPONSORKIT_OPENCOLLECTIVE_SLUG` environment variable if not set.
         */
        slug?: string;
        /**
         * The GitHub handle of your account.
         *
         * Will read from `SPONSORKIT_OPENCOLLECTIVE_GH_HANDLE` environment variable if not set.
         */
        githubHandle?: string;
        type?: string;
    };
    afdian?: {
        /**
         * The userId of your Afdian.
         *
         * Will read from `SPONSORKIT_AFDIAN_USER_ID` environment variable if not set.
         *
         * @see https://afdian.net/dashboard/dev
         */
        userId?: string;
        /**
         * Afdian Token that have access to your sponsorships.
         *
         * Will read from `SPONSORKIT_AFDIAN_TOKEN` environment variable if not set.
         *
         * @see https://afdian.net/dashboard/dev
         * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
         */
        token?: string;
        /**
         * Exchange rate of USD to CNY
         *
         * @default 6.5
         */
        exechangeRate?: number;
        /**
         * Include one-time purchases
         * @default true
         */
        includePurchases?: boolean;
        /**
         * One-time purchase effectivity period in days
         * @default 30
         */
        purchaseEffectivity?: number;
    };
    polar?: {
        /**
         * Polar token that have access to your sponsorships.
         *
         * Will read from `SPONSORKIT_POLAR_TOKEN` environment variable if not set.
         *
         * @see https://polar.sh/settings
         * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
         */
        token?: string;
        /**
         * The name of the organization to fetch sponsorships from. If not set, it will fetch the sponsorships of the user.
         *
         * Will read from `SPONSORKIT_POLAR_ORGANIZATION` environment variable if not set.
         */
        organization?: string;
    };
}
interface SponsorkitRenderOptions {
    /**
     * Name of exported files
     *
     * @default 'sponsors'
     */
    name?: string;
    /**
     * Renderer to use
     *
     * @default 'tiers'
     */
    renderer?: 'tiers' | 'circles';
    /**
     * Output formats
     *
     * @default ['json', 'svg', 'png']
     */
    formats?: OutputFormat[];
    /**
     * Compose the SVG
     */
    customComposer?: (composer: SvgComposer, sponsors: Sponsorship[], config: SponsorkitConfig) => PromiseLike<void> | void;
    /**
     * Filter of sponsorships to render in the final image.
     */
    filter?: (sponsor: Sponsorship, all: Sponsorship[]) => boolean | void;
    /**
     * Tiers
     *
     * Only effective when using `tiers` renderer.
     */
    tiers?: Tier[];
    /**
     * Options for rendering circles
     *
     * Only effective when using `circles` renderer.
     */
    circles?: CircleRenderOptions;
    /**
     * Width of the image.
     *
     * @default 800
     */
    width?: number;
    /**
     * Padding of image container
     */
    padding?: {
        top?: number;
        bottom?: number;
    };
    /**
     * Inline CSS of generated SVG
     */
    svgInlineCSS?: string;
    /**
     * Whether to display the private sponsors
     *
     * @default false
     */
    includePrivate?: boolean;
    /**
     * Whether to display the past sponsors
     * Currently only works with GitHub provider
     *
     * @default auto detect based on tiers
     */
    includePastSponsors?: boolean;
    /**
     * Format of embedded images
     *
     * @default 'webp'
     */
    imageFormat?: ImageFormat;
    /**
     * Hook to modify sponsors data before rendering.
     */
    onBeforeRenderer?: (sponsors: Sponsorship[]) => PromiseLike<void | Sponsorship[]> | void | Sponsorship[];
    /**
     * Hook to get or modify the SVG before writing.
     */
    onSvgGenerated?: (svg: string) => PromiseLike<string | void | undefined | null> | string | void | undefined | null;
}
interface SponsorkitConfig extends ProvidersConfig, SponsorkitRenderOptions {
    /**
     * @deprecated use `github.login` instead
     */
    login?: string;
    /**
     * @deprecated use `github.token` instead
     */
    token?: string;
    /**
     * @default auto detect based on the config provided
     */
    providers?: (ProviderName | Provider)[];
    /**
     * By pass cache
     */
    force?: boolean;
    /**
     * Path to cache file
     *
     * @default './sponsorkit/.cache.json'
     */
    cacheFile?: string;
    /**
     * Directory of output files.
     *
     * @default './sponsorkit'
     */
    outputDir?: string;
    /**
     * Replace links in the sponsors data.
     */
    replaceLinks?: Record<string, string> | (((sponsor: Sponsorship) => string) | Record<string, string>)[];
    /**
     * Replace avatar link in the sponsors data.
     */
    replaceAvatars?: Record<string, string> | (((sponsor: Sponsorship) => string) | Record<string, string>)[];
    /**
     * Merge multiple sponsors, useful for combining sponsors from different providers.
     *
     * @example
     * ```js
     * mergeSponsors: [
     *   // Array of sponsor matchers
     *   [{ login: 'antfu', provider: 'github' }, { login: 'antfu', provider: 'patreon' }],
     *   // custom functions to find matched sponsors
     *   (sponsor, allSponsors) => {
     *     return allSponsors.filter(s => s.sponsor.login === sponsor.sponsor.login)
     *   }
     * ]
     * ```
     */
    mergeSponsors?: (SponsorMatcher[] | ((sponsor: Sponsorship, allSponsors: Sponsorship[]) => Sponsorship[] | void))[];
    /**
     * Merge sponsorships from same sponsor on different providers,
     * based on their connection account on each platform.
     *
     * @default false
     */
    sponsorsAutoMerge?: boolean;
    /**
     * Hook to modify sponsors data for each provider.
     */
    onSponsorsFetched?: (sponsors: Sponsorship[], provider: ProviderName | string) => PromiseLike<void | Sponsorship[]> | void | Sponsorship[];
    /**
     * Hook to modify merged sponsors data before fetching the avatars.
     */
    onSponsorsAllFetched?: (sponsors: Sponsorship[]) => PromiseLike<void | Sponsorship[]> | void | Sponsorship[];
    /**
     * Hook to modify sponsors data before rendering.
     */
    onSponsorsReady?: (sponsors: Sponsorship[]) => PromiseLike<void | Sponsorship[]> | void | Sponsorship[];
    /**
     * Url to fallback avatar.
     * Setting false to disable fallback avatar.
     */
    fallbackAvatar?: string | false | Buffer$1 | Promise<Buffer$1>;
    /**
     * Configs for multiple renders
     */
    renders?: SponsorkitRenderOptions[];
    /**
     * Prorates one-time to the current month's tier
     */
    prorateOnetime?: boolean;
}
interface SponsorMatcher extends Partial<Pick<Sponsor, 'login' | 'name' | 'type'>> {
    provider?: ProviderName | string;
}
type SponsorkitMainConfig = Omit<SponsorkitConfig, keyof SponsorkitRenderOptions>;
interface SponsorkitRenderer {
    name: string;
    renderSVG: (config: Required<SponsorkitRenderOptions>, sponsors: Sponsorship[]) => Promise<string>;
}
interface CircleRenderOptions {
    /**
     * Min radius for sponsors
     *
     * @default 10
     */
    radiusMin?: number;
    /**
     * Max radius for sponsors
     *
     * @default 300
     */
    radiusMax?: number;
    /**
     * Radius for past sponsors
     *
     * @default 5
     */
    radiusPast?: number;
    /**
     * Custom function to calculate the weight of the sponsor.
     *
     * When provided, `radiusMin`, `radiusMax` and `radiusPast` will be ignored.
     */
    weightInterop?: (sponsor: Sponsorship, maxAmount: number) => number;
}
interface Tier {
    /**
     * The lower bound of the tier (inclusive)
     */
    monthlyDollars?: number;
    title?: string;
    preset?: BadgePreset;
    padding?: {
        top?: number;
        bottom?: number;
    };
    /**
     * Replace the default composer with your own.
     */
    compose?: (composer: SvgComposer, sponsors: Sponsorship[], config: SponsorkitConfig) => void;
    /**
     * Compose the SVG before the main composer.
     */
    composeBefore?: (composer: SvgComposer, tierSponsors: Sponsorship[], config: SponsorkitConfig) => void;
    /**
     * Compose the SVG after the main composer.
     */
    composeAfter?: (composer: SvgComposer, tierSponsors: Sponsorship[], config: SponsorkitConfig) => void;
}

declare const defaultTiers: Tier[];
declare const defaultInlineCSS = "\ntext {\n  font-weight: 300;\n  font-size: 14px;\n  fill: #777777;\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;\n}\n.sponsorkit-link {\n  cursor: pointer;\n}\n.sponsorkit-tier-title {\n  font-weight: 500;\n  font-size: 20px;\n}\n";
declare const defaultConfig: SponsorkitConfig;

declare const FALLBACK_AVATAR: Promise<Buffer>;

declare const tierPresets: {
    none: BadgePreset;
    xs: BadgePreset;
    small: BadgePreset;
    base: BadgePreset;
    medium: BadgePreset;
    large: BadgePreset;
    xl: BadgePreset;
};
/**
 * @deprecated Use `tierPresets` instead
 */
declare const presets: {
    none: BadgePreset;
    xs: BadgePreset;
    small: BadgePreset;
    base: BadgePreset;
    medium: BadgePreset;
    large: BadgePreset;
    xl: BadgePreset;
};

declare function defineConfig(config: SponsorkitConfig): SponsorkitConfig;
declare function loadConfig(inlineConfig?: SponsorkitConfig): Promise<Required<SponsorkitConfig>>;
declare function partitionTiers(sponsors: Sponsorship[], tiers: Tier[], includePastSponsors?: boolean): TierPartition[];

declare function resolveAvatars(ships: Sponsorship[], getFallbackAvatar: SponsorkitConfig['fallbackAvatar'], t?: consola.ConsolaInstance): Promise<void[]>;
declare function resizeImage(image: Buffer$1, size: number | undefined, format: ImageFormat): Promise<Buffer$1>;
declare function svgToPng(svg: string): Promise<Buffer$1>;
declare function svgToWebp(svg: string): Promise<Buffer$1>;

declare const GitHubProvider: Provider;
declare function fetchGitHubSponsors(token: string, login: string, type: GitHubAccountType, config: SponsorkitConfig): Promise<Sponsorship[]>;
declare function makeQuery(login: string, type: GitHubAccountType, activeOnly?: boolean, cursor?: string): string;

declare const ProvidersMap: {
    github: Provider;
    patreon: Provider;
    opencollective: Provider;
    afdian: Provider;
    polar: Provider;
};
declare function guessProviders(config: SponsorkitConfig): ProviderName[];
declare function resolveProviders(names: (ProviderName | Provider)[]): Provider[];
declare function fetchSponsors(config: SponsorkitConfig): Promise<Sponsorship[]>;

export { type BadgePreset, type CircleRenderOptions, FALLBACK_AVATAR, type GitHubAccountType, GitHubProvider, type ImageFormat, type OutputFormat, type Provider, type ProviderName, type ProvidersConfig, ProvidersMap, type Sponsor, type SponsorMatcher, type SponsorkitConfig, type SponsorkitMainConfig, type SponsorkitRenderOptions, type SponsorkitRenderer, type Sponsorship, SvgComposer, type Tier, type TierPartition, defaultConfig, defaultInlineCSS, defaultTiers, defineConfig, fetchGitHubSponsors, fetchSponsors, genSvgImage, generateBadge, guessProviders, loadConfig, makeQuery, outputFormats, partitionTiers, presets, resizeImage, resolveAvatars, resolveProviders, svgToPng, svgToWebp, tierPresets };
