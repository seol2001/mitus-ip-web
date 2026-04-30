// 기존 코드 하단에 아래 내용을 추가 (또는 파일 전체를 이걸 포함해 덮어쓰기)

export const DEFAULT_OVERVIEW_SCHEMA = [
  { id: "Body_1_KeyFeatures", label: "1. Key Features", rows: 4, placeholder: "- 항목별 설명을 입력하세요." },
  { id: "Body_2_Specs", label: "2. Major Design Specifications", rows: 6, fontMono: true },
  { id: "Body_3_DesignFocus", label: "3. Design Focus", rows: 4 },
  { id: "Body_4_Milestones", label: "4. Project Milestones", rows: 4 },
  { id: "Body_5_References", label: "5. Reference Documents & Attachments", rows: 5 },
];

export const MAJOR_SPECS_SCHEMA = [
  { id: "Operating_Voltage", label: "Operating Voltage", type: "text", colSpan: 1 },
  { id: "Switching_Frequency", label: "Switching Freq.", type: "text", colSpan: 1 },
  { id: "Quiescent_current", label: "Quiescent Current", type: "text", colSpan: 1 },
  { id: "Chip_Area_Target", label: "Chip Area Target", type: "text", colSpan: 1 },
  { id: "Package", label: "Package Type", type: "text", colSpan: 2 },
];

export const ORGANIZATION_SCHEMA = [
  { id: "Design_Team", label: "Design Team(s)", type: "textarea", rows: 2, colSpan: 3 },
  { id: "Designers", label: "Designers", type: "textarea", rows: 3, colSpan: 3 },
  { id: "ATE", label: "ATE", type: "text", colSpan: 1 },
  { id: "QE", label: "QE", type: "text", colSpan: 1 },
  { id: "FAE", label: "FAE", type: "text", colSpan: 1 },
];

// 🚀 새롭게 추가된 IP Index 카드 스키마 (숫자 제외)
export const DEFAULT_IP_CONTENTS_SCHEMA = [
  { id: "Architecture", label: "IP Architecture & Components", type: "architecture" },
  { id: "Summary", label: "Summary Embedding", type: "summary" },
  { id: "Focus", label: "설계 주안점", type: "focus" }
];