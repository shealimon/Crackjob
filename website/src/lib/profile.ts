import { z } from "zod";

export const DEFAULT_COUNTRY_CODE = "+91";

/** Common dial codes — India first (default). */
export const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "United States (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+86", label: "China (+86)" },
  { code: "+852", label: "Hong Kong (+852)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+974", label: "Qatar (+974)" },
  { code: "+968", label: "Oman (+968)" },
  { code: "+973", label: "Bahrain (+973)" },
  { code: "+965", label: "Kuwait (+965)" },
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+880", label: "Bangladesh (+880)" },
  { code: "+94", label: "Sri Lanka (+94)" },
  { code: "+977", label: "Nepal (+977)" },
] as const;

export const PROFILE_SELECT = {
  firstName: true,
  lastName: true,
  countryCode: true,
  mobileNo: true,
  jobRole: true,
  currentCompany: true,
  yearsOfExperience: true,
  linkedinUrl: true,
  currentLocation: true,
  preferredLocations: true,
  preferredStack: true,
  resumeText: true,
  resumeFileName: true,
  resumeFilePath: true,
  resumeMimeType: true,
} as const;

export type ProfileRow = {
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  mobileNo: string | null;
  jobRole: string | null;
  currentCompany: string | null;
  yearsOfExperience: number | null;
  linkedinUrl: string | null;
  currentLocation: string | null;
  preferredLocations: string | null;
  preferredStack: string | null;
  resumeText: string | null;
  resumeFileName: string | null;
  resumeFilePath: string | null;
  resumeMimeType: string | null;
};

export type PublicProfile = {
  firstName: string | null;
  lastName: string | null;
  countryCode: string;
  mobileNo: string | null;
  jobRole: string | null;
  currentCompany: string | null;
  yearsOfExperience: number | null;
  linkedinUrl: string | null;
  currentLocation: string | null;
  preferredLocations: string | null;
  preferredStack: string | null;
  resumeFileName: string | null;
  hasResume: boolean;
};

export function toPublicProfile(profile: ProfileRow | null): PublicProfile {
  if (!profile) {
    return {
      firstName: null,
      lastName: null,
      countryCode: DEFAULT_COUNTRY_CODE,
      mobileNo: null,
      jobRole: null,
      currentCompany: null,
      yearsOfExperience: null,
      linkedinUrl: null,
      currentLocation: null,
      preferredLocations: null,
      preferredStack: null,
      resumeFileName: null,
      hasResume: false,
    };
  }
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    countryCode: profile.countryCode?.trim() || DEFAULT_COUNTRY_CODE,
    mobileNo: profile.mobileNo,
    jobRole: profile.jobRole,
    currentCompany: profile.currentCompany,
    yearsOfExperience: profile.yearsOfExperience,
    linkedinUrl: profile.linkedinUrl,
    currentLocation: profile.currentLocation,
    preferredLocations: profile.preferredLocations,
    preferredStack: profile.preferredStack,
    resumeFileName: profile.resumeFileName,
    hasResume: Boolean(profile.resumeText?.trim() || profile.resumeFilePath),
  };
}

const optionalTrimmed = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed || null;
  });

const countryCodeSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null) return DEFAULT_COUNTRY_CODE;
    const trimmed = value.trim();
    if (!trimmed) return DEFAULT_COUNTRY_CODE;
    return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  });

export const profileUpdateSchema = z
  .object({
    firstName: optionalTrimmed,
    lastName: optionalTrimmed,
    countryCode: countryCodeSchema,
    mobileNo: optionalTrimmed,
    jobRole: optionalTrimmed,
    currentCompany: optionalTrimmed,
    yearsOfExperience: z.union([z.number(), z.string(), z.null()]).optional(),
    linkedinUrl: optionalTrimmed,
    currentLocation: optionalTrimmed,
    preferredLocations: optionalTrimmed,
    preferredStack: optionalTrimmed,
  })
  .superRefine((data, ctx) => {
    if (data.yearsOfExperience === undefined) return;
    if (data.yearsOfExperience === null || data.yearsOfExperience === "") return;
    const num =
      typeof data.yearsOfExperience === "number"
        ? data.yearsOfExperience
        : Number(data.yearsOfExperience);
    if (!Number.isFinite(num) || num < 0 || num > 60) {
      ctx.addIssue({
        code: "custom",
        path: ["yearsOfExperience"],
        message: "Years of experience must be between 0 and 60",
      });
    }
  })
  .transform((data) => {
    let yearsOfExperience: number | null | undefined = data.yearsOfExperience as
      | number
      | null
      | undefined;
    if (data.yearsOfExperience === undefined) {
      yearsOfExperience = undefined;
    } else if (data.yearsOfExperience === null || data.yearsOfExperience === "") {
      yearsOfExperience = null;
    } else {
      const num =
        typeof data.yearsOfExperience === "number"
          ? data.yearsOfExperience
          : Number(data.yearsOfExperience);
      yearsOfExperience = Math.round(num * 10) / 10;
    }
    return { ...data, yearsOfExperience };
  });

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
