import { z } from 'zod';

// 1. IP 블록 스키마 (핵심 취약점 방어)
const IpBlockSchema = z.object({
  IP_Name: z.string().default("Unknown").catch("Unknown"),
  IP_Status: z.string().default("Active").catch("Active"),
  // Auto-Healing: 문자열 배열 혹은 객체 배열 모두 수용 가능하도록 유연화
  Sub_Blocks: z.array(z.union([z.string(), z.record(z.any())])).default([]).catch([])
}).passthrough(); // 미래에 추가될 수 있는 다른 필드들은 통과시킴

// 2. Revision 스키마
const RevisionSchema = z.object({
  status: z.string().default("draft").catch("draft"),
  ipIndex: z.record(z.string(), IpBlockSchema).default({}).catch({}),
  faReport: z.object({ 
    faReports: z.array(z.any()).default([]).catch([]) 
  }).passthrough().default({ faReports: [] }).catch({ faReports: [] }),
  revisionLog: z.object({
    issues: z.array(z.any()).default([]).catch([]),
    initialMode: z.string().default("new").catch("new"),
    loadedIssues: z.array(z.any()).default([]).catch([]),
    historyBlocks: z.array(z.any()).default([]).catch([])
  }).passthrough().default({ issues: [], loadedIssues: [], historyBlocks: [] }).catch({ issues: [], loadedIssues: [], historyBlocks: [] }),
  projectOverview: z.record(z.string(), z.any()).default({}).catch({})
}).passthrough();

// 3. Project 전체 스키마
export const ProjectSchema = z.object({
  app: z.literal("Mitus-IP-Web").catch("Mitus-IP-Web"),
  version: z.string().default("1.0").catch("1.0"),
  export_at: z.string().optional(),
  exported_by: z.string().optional(),
  project: z.object({
    id: z.string().min(1, "프로젝트 ID는 필수입니다."),
    name: z.string().default("Unknown Project").catch("Unknown Project"),
    phases: z.array(z.string()).default([]).catch([]),
    latest_evt: z.string().default("").catch(""),
    is_archived: z.boolean().default(false).catch(false),
    project_data: z.object({
      version: z.number().default(1).catch(1),
      projectId: z.string().default("").catch(""),
      revisions: z.record(z.string(), RevisionSchema).default({}).catch({})
    }).passthrough().default({}).catch({})
  }).passthrough()
}).passthrough();
