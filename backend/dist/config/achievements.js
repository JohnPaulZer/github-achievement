"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACHIEVEMENT_DEFINITIONS = void 0;
function makeBadgeImage(text, accent, secondary) {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${text} badge">
      <defs>
        <linearGradient id="badgeGradient" x1="10%" y1="10%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="${secondary}" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="#0d1117" />
      <rect
        x="8"
        y="8"
        width="112"
        height="112"
        rx="24"
        fill="url(#badgeGradient)"
        fill-opacity="0.16"
        stroke="${accent}"
        stroke-opacity="0.55"
      />
      <circle cx="64" cy="36" r="16" fill="${secondary}" fill-opacity="0.2" />
      <path
        d="M34 88c9-20 51-20 60 0"
        fill="none"
        stroke="${secondary}"
        stroke-width="6"
        stroke-linecap="round"
        stroke-opacity="0.45"
      />
      <text
        x="64"
        y="76"
        text-anchor="middle"
        fill="#f8fafc"
        font-size="24"
        font-family="Segoe UI, Arial, sans-serif"
        font-weight="700"
        letter-spacing="1.5"
      >
        ${text}
      </text>
      <text
        x="64"
        y="97"
        text-anchor="middle"
        fill="${accent}"
        font-size="11"
        font-family="Segoe UI, Arial, sans-serif"
        font-weight="600"
        letter-spacing="2"
      >
        GITHUB TRACKER
      </text>
    </svg>
  `.trim();
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
exports.ACHIEVEMENT_DEFINITIONS = {
    starstruck: {
        id: "starstruck",
        name: "Starstruck",
        description: "Create a repository that has many stars.",
        instructions: "Create useful public repositories and promote them to gain stars.",
        unit: "stars",
        tiers: [
            { label: "Default", target: 16 },
            { label: "Bronze", target: 128 },
            { label: "Silver", target: 512 },
            { label: "Gold", target: 4096 },
        ],
        estimatedByDefault: true,
        badgeImageUrl: makeBadgeImage("STAR", "#f59e0b", "#38bdf8"),
    },
    quickdraw: {
        id: "quickdraw",
        name: "Quickdraw",
        description: "Close an issue or pull request within 5 minutes of opening.",
        instructions: "Open an issue or PR and close it within 5 minutes.",
        unit: "qualifying closes",
        tiers: [{ label: "Default", target: 1 }],
        estimatedByDefault: true,
        badgeImageUrl: makeBadgeImage("QD", "#fb7185", "#f97316"),
    },
    "pair-extraordinaire": {
        id: "pair-extraordinaire",
        name: "Pair Extraordinaire",
        description: "Coauthor commits on merged pull requests.",
        instructions: "Collaborate with another developer and use co-authored commits in a merged pull request.",
        unit: "merged PRs",
        tiers: [
            { label: "Default", target: 1 },
            { label: "Bronze", target: 10 },
            { label: "Silver", target: 24 },
            { label: "Gold", target: 48 },
        ],
        estimatedByDefault: true,
        badgeImageUrl: makeBadgeImage("PAIR", "#34d399", "#22d3ee"),
    },
    "pull-shark": {
        id: "pull-shark",
        name: "Pull Shark",
        description: "Open a pull request that has been merged.",
        instructions: "Submit pull requests to repositories and get them merged.",
        unit: "merged PRs",
        tiers: [
            { label: "Default", target: 2 },
            { label: "Bronze", target: 16 },
            { label: "Silver", target: 128 },
            { label: "Gold", target: 1024 },
        ],
        estimatedByDefault: true,
        badgeImageUrl: makeBadgeImage("SHARK", "#60a5fa", "#38bdf8"),
    },
    "galaxy-brain": {
        id: "galaxy-brain",
        name: "Galaxy Brain",
        description: "Answer a discussion and get an accepted answer.",
        instructions: "Answer GitHub Discussions and get your answer marked as accepted.",
        unit: "accepted answers",
        tiers: [
            { label: "Default", target: 2 },
            { label: "Bronze", target: 8 },
            { label: "Silver", target: 16 },
            { label: "Gold", target: 32 },
        ],
        estimatedByDefault: true,
        badgeImageUrl: makeBadgeImage("GALAXY", "#c084fc", "#2dd4bf"),
    },
    yolo: {
        id: "yolo",
        name: "YOLO",
        description: "Merge a pull request without a review.",
        instructions: "Merge a pull request without waiting for a review.",
        unit: "unreviewed merges",
        tiers: [{ label: "Default", target: 1 }],
        estimatedByDefault: true,
        badgeImageUrl: makeBadgeImage("YOLO", "#f472b6", "#facc15"),
    },
    "public-sponsor": {
        id: "public-sponsor",
        name: "Public Sponsor",
        description: "Sponsor an open source contributor or donate to JohnPaulZer through GitHub Sponsors.",
        instructions: "Publicly sponsor an open source contributor or donate to JohnPaulZer using GitHub Sponsors.",
        unit: "sponsorships",
        tiers: [{ label: "Default", target: 1 }],
        estimatedByDefault: false,
        badgeImageUrl: makeBadgeImage("SPONSOR", "#4ade80", "#2dd4bf"),
    },
};
//# sourceMappingURL=achievements.js.map