export type Personality = "introvert" | "extrovert" | "logical" | "creative" | "leader" | "supporter";

export interface Career {
  name: string;
  emoji: string;
  interests: string[];
  skills: string[];
  personality: Personality[];
  improve: string[];
  scope: string;
}

export const INTERESTS = ["Technology", "Art", "Business", "Science", "Sports", "Education", "Media"];
export const SKILLS = ["Coding", "Communication", "Design", "Analysis", "Writing", "Leadership"];

export const CAREERS: Career[] = [
  {
    name: "Software Engineer",
    emoji: "💻",
    interests: ["Technology", "Science"],
    skills: ["Coding", "Analysis"],
    personality: ["logical", "introvert"],
    improve: ["System design", "Algorithms", "Cloud platforms"],
    scope: "One of the fastest-growing fields globally with strong demand across every industry.",
  },
  {
    name: "Data Scientist",
    emoji: "📊",
    interests: ["Technology", "Science", "Business"],
    skills: ["Coding", "Analysis"],
    personality: ["logical", "introvert"],
    improve: ["Statistics", "Machine learning", "SQL & Python"],
    scope: "Massive growth as companies increasingly rely on data-driven decision making.",
  },
  {
    name: "Graphic Designer",
    emoji: "🎨",
    interests: ["Art", "Media"],
    skills: ["Design", "Communication"],
    personality: ["creative", "introvert"],
    improve: ["Figma & Adobe suite", "Typography", "Motion design"],
    scope: "Steady demand in branding, product, and digital media — freelance friendly.",
  },
  {
    name: "Psychologist",
    emoji: "🧠",
    interests: ["Science", "Education"],
    skills: ["Communication", "Analysis"],
    personality: ["supporter", "extrovert"],
    improve: ["Active listening", "Clinical research", "Certifications"],
    scope: "Growing recognition of mental health is expanding opportunities globally.",
  },
  {
    name: "Business Analyst",
    emoji: "📈",
    interests: ["Business", "Technology"],
    skills: ["Analysis", "Communication"],
    personality: ["logical", "leader"],
    improve: ["SQL", "Stakeholder communication", "Process modeling"],
    scope: "Bridge between business and tech — strong demand across enterprises.",
  },
  {
    name: "Teacher",
    emoji: "📚",
    interests: ["Education", "Science", "Art"],
    skills: ["Communication", "Leadership"],
    personality: ["supporter", "extrovert"],
    improve: ["Curriculum design", "Public speaking", "EdTech tools"],
    scope: "Stable career with rising demand in online education and tutoring.",
  },
  {
    name: "Content Creator",
    emoji: "🎬",
    interests: ["Media", "Art", "Business"],
    skills: ["Writing", "Communication", "Design"],
    personality: ["creative", "extrovert"],
    improve: ["Video editing", "Storytelling", "Audience growth"],
    scope: "Booming creator economy with diverse monetization paths.",
  },
  {
    name: "Product Manager",
    emoji: "🚀",
    interests: ["Business", "Technology"],
    skills: ["Leadership", "Communication", "Analysis"],
    personality: ["leader", "logical"],
    improve: ["User research", "Prioritization frameworks", "Analytics"],
    scope: "High-impact role with strong compensation and career growth.",
  },
];

export interface UserProfile {
  interests: string[];
  skills: Record<string, number>; // 1-5
  personality: Personality[];
}

export interface Recommendation {
  career: Career;
  score: number;
  reason: string;
}

export function scoreCareers(profile: UserProfile): Recommendation[] {
  const results = CAREERS.map((career) => {
    // Interests: % overlap
    const interestMatch =
      career.interests.filter((i) => profile.interests.includes(i)).length /
      Math.max(career.interests.length, 1);

    // Skills: average normalized rating across required skills
    const skillScores = career.skills.map((s) => (profile.skills[s] ?? 0) / 5);
    const skillMatch = skillScores.reduce((a, b) => a + b, 0) / Math.max(skillScores.length, 1);

    // Personality: overlap ratio
    const personalityMatch =
      career.personality.filter((p) => profile.personality.includes(p)).length /
      Math.max(career.personality.length, 1);

    const score = Math.round((interestMatch * 0.3 + skillMatch * 0.4 + personalityMatch * 0.3) * 100);

    const matchedInterests = career.interests.filter((i) => profile.interests.includes(i));
    const matchedTraits = career.personality.filter((p) => profile.personality.includes(p));
    const reason = [
      matchedInterests.length
        ? `your interest in ${matchedInterests.join(" & ")}`
        : null,
      skillMatch > 0.5 ? `strong ratings in ${career.skills.join(", ")}` : null,
      matchedTraits.length ? `a ${matchedTraits.join("/")} personality` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      career,
      score,
      reason: reason ? `Fits ${reason}.` : "Partial alignment with your profile.",
    };
  });

  return results.sort((a, b) => b.score - a.score);
}