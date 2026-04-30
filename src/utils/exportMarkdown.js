import { DEFAULT_OVERVIEW_SCHEMA, MAJOR_SPECS_SCHEMA, ORGANIZATION_SCHEMA, DEFAULT_IP_CONTENTS_SCHEMA } from '../data/schemaConfig';

const getToday = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().split('T')[0];
};

// ─── 공통 동적 렌더링 (알 수 없는 추가 필드 및 예외 처리) ───
const renderDynamicFields = (obj, excludeKeys = [], isSubItem = false) => {
  let md = '';
  if (!obj || typeof obj !== 'object') return md;

  Object.entries(obj).forEach(([key, val]) => {
    if (excludeKeys.includes(key) || val === '' || val === null || val === undefined) return;
    let displayKey = key;

    if (typeof val === 'string') {
      const strVal = val.trim();
      if (strVal.includes('\n')) {
        const quoted = strVal.split('\n').map(line => `  > ${line}`).join('\n');
        md += `- **${displayKey}:**\n${quoted}\n`;
      } else {
        md += `- **${displayKey}:** ${strVal}\n`;
      }
    } else if (Array.isArray(val)) {
      if (val.length > 0) {
        const stringItems = val.filter(item => typeof item !== 'object').map(String);
        let healedArray = [];
        let brokenStr = '';
        stringItems.forEach(item => {
          if (item.length === 1) {
            brokenStr += item;
          } else {
            if (brokenStr) { healedArray.push(brokenStr); brokenStr = ''; }
            healedArray.push(item);
          }
        });
        if (brokenStr) healedArray.push(brokenStr);
        const finalVal = [...new Set(healedArray)].join(', ');
        md += `- **${displayKey}:** ${finalVal}\n`;
      }
    } else if (typeof val === 'object') {
      md += isSubItem ? `- **${displayKey}:**\n` : `### 📌 ${displayKey}\n`;
      Object.entries(val).forEach(([subKey, subVal]) => {
        if (subVal !== '' && subVal !== null && subVal !== undefined) {
          const formattedSubVal = String(subVal).replace(/\n/g, ' ');
          md += isSubItem ? `  - **${subKey}:** ${formattedSubVal}\n` : `- **${subKey}:** ${formattedSubVal}\n`;
        }
      });
      if (!isSubItem) md += '\n';
    } else {
      md += `- **${displayKey}:** ${String(val)}\n`;
    }
  });
  return md;
};

const formatIssueDetails = (i, pName) => {
  let md = '';
  const iId = i.entryMode === 'new' ? `${i.ipBlock}.${pName}.${i.issueNum}` : i.targetIssue;
  const isClosed = i.disposition === 'Closed' || i.disposition === 'Waived' || i.disposition === 'Acceptable' || (i.entryMode === 'eval' && i.assessment === 'Fixed');
  const statusIcon = isClosed ? '✅' : '🔴';

  md += `#### ${statusIcon} [${i.severity || 'Major'}] ${iId}\n`;
  const excludeKeys = ['id', 'ipBlock', 'issueNum', 'targetIssue', 'severity'];
  md += renderDynamicFields(i, excludeKeys, true);
  md += `\n`; 
  return md;
};

// ─── 1. Project Overview 생성 (🚀 테이블 포맷 및 배열 에러 완벽 수정) ───
export const getOverviewMD = (pName, rev, overview = {}) => {
  let md = `---\n`;
  md += `document_type: "Project_Overview"\nproject: "${pName}"\nstage: "${rev}"\nfoundry: "${overview.Foundry || 'N/A'}"\nprocess: "${overview.Process || 'N/A'}"\ncustomer: "${overview.Customer_Name || 'N/A'}"\n---\n\n`;
  md += `# Project Overview: ${pName} (${rev})\n\n> **Exported Date:** ${getToday()}  \n\n---\n\n`;

  md += `- **Foundry:** ${overview.Foundry || ''}\n`;
  md += `- **Process:** ${overview.Process || ''}\n`;
  
  // 🚀 OSAT 글자 깨짐 버그 수정
  if (overview.OSAT_Partner) {
    if (Array.isArray(overview.OSAT_Partner)) {
      const cleaned = overview.OSAT_Partner.filter(item => item.length > 1); // 1글자짜리 찌꺼기 방어
      if (cleaned.length > 0) md += `- **OSAT_Partner:** ${cleaned.join(', ')}\n`;
    } else if (typeof overview.OSAT_Partner === 'string') {
      md += `- **OSAT_Partner:** ${overview.OSAT_Partner}\n`;
    }
  }

  md += `- **Mother_Project:** ${overview.Mother_Project || ''}\n`;
  md += `- **Customer_Name:** ${overview.Customer_Name || ''}\n`;
  md += `- **Target_Application:** ${overview.Target_Application || ''}\n\n`;

  md += `### 📌 Organization\n`;
  const orgSchema = overview.UI_Schemas?.Organization || ORGANIZATION_SCHEMA;
  orgSchema.forEach(field => {
    const val = overview.Organization?.[field.id] || '';
    const strVal = String(val).trim();
    if (strVal) {
      if (strVal.includes('\n')) {
        const quoted = strVal.split('\n').map(line => `  > ${line}`).join('\n');
        md += `- **${field.label}:**\n${quoted}\n`;
      } else {
        md += `- **${field.label}:** ${strVal}\n`;
      }
    } else {
      md += `- **${field.label}:**\n`;
    }
  });
  md += `\n`;

  md += `### 📌 Specs\n`;
  const specsSchema = overview.UI_Schemas?.Specs || MAJOR_SPECS_SCHEMA;
  specsSchema.forEach(field => {
    const val = overview.Specs?.[field.id] || '';
    md += `- **${field.label}:** ${val}\n`;
  });
  md += `\n`;

  if (overview.TO_Dates) {
    md += `### 📌 TO_Dates\n`;
    Object.entries(overview.TO_Dates).forEach(([k, v]) => {
      if (v) md += `- **${k}:** ${v}\n`;
    });
    md += `\n`;
  }

  if (overview.IP_Blocks && overview.IP_Blocks.length > 0) {
    md += `- **IP_Blocks:** ${overview.IP_Blocks.join(', ')}\n\n`;
  }

  const contentsSchema = overview.UI_Schemas?.Contents || DEFAULT_OVERVIEW_SCHEMA;
  contentsSchema.forEach(field => {
    const val = overview[field.id];

    // 🚀 복구된 테이블 형태의 마크다운 표 렌더링 로직
    if (field.type === 'table') {
      md += `- **${field.label}:**\n`;
      md += `  > | Item | Specification | Unit | Remarks |\n`;
      md += `  > | :--- | :--- | :--- | :--- |\n`;
      
      const tableData = typeof val === 'object' && val !== null ? val : {};
      (field.templateRows || []).forEach(row => {
        const rData = tableData[row.id] || {};
        // 파이프(|)나 줄바꿈이 표를 깨지 않도록 이스케이프 처리
        const spec = String(rData.spec || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
        const unit = String(rData.unit || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
        const rem = String(rData.remarks || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
        
        md += `  > | ${row.item} | ${spec} | ${unit} | ${rem} |\n`;
      });
      md += `\n`;
    } else {
      // 일반 텍스트 영역 렌더링
      const strVal = String(val || '').trim();
      if (strVal) {
        const quoted = strVal.split('\n').map(line => `  > ${line}`).join('\n');
        md += `- **${field.label}:**\n${quoted}\n`;
      } else {
        md += `- **${field.label}:**\n`; 
      }
    }
  });

  return md;
};

// ─── 2. IP Index 생성 (🚀 카드 정렬, 자동 넘버링, 고아 데이터 힐링, 시스템 변수 은닉) ───
export const getIpIndexMD = (pName, rev, ipName, ipData = {}, revLog = {}) => {
  let md = `---\ndocument_type: "IP_Index"\nproject: "${pName}"\nstage: "${rev}"\nip_name: "${ipName}"\nip_category: "${ipData.IP_Category || 'N/A'}"\n---\n\n`;
  md += `# IP Index: ${ipName} - ${pName} (${rev})\n\n`;

  // 1. IP Identity & Lineage
  md += `### 📌 IP Identity & Lineage\n`;
  md += `- **IP_Category:** ${ipData.IP_Category || ''}\n`;
  md += `- **IP_Name:** ${ipData.IP_Name || ''}\n`;
  md += `- **IP_Status:** ${ipData.IP_Status || ''}\n`;
  md += `- **Mother_Project:** ${ipData.Mother_Project || ''}\n`;
  md += `- **Modification_Level:** ${ipData.Modification_Level || ''}\n`;
  md += `- **Mother_IP_Index_Path:** ${ipData.Mother_IP_Index_Path || ''}\n\n`;

  // 2. 문서 관리 정보
  md += `### 📌 문서 관리 정보\n`;
  md += `- **Design_Owner:** ${ipData.Design_Owner || ''}\n`;
  md += `- **Last_Updated:** ${ipData.Last_Updated || ''}\n\n`;

  // 3. Key Spec
  md += `### 📌 Key Spec\n`;
  if (ipData.UI_Schemas && ipData.UI_Schemas.Key_Spec && ipData.UI_Schemas.Key_Spec.length > 0) {
    ipData.UI_Schemas.Key_Spec.forEach(field => {
      const val = ipData.Key_Spec?.[field.id] || '';
      md += `- **${field.label}:** ${val}\n`;
    });
  } else if (ipData.Key_Spec && Object.keys(ipData.Key_Spec).length > 0) {
    Object.entries(ipData.Key_Spec).forEach(([k, v]) => {
      md += `- **${k}:** ${v || ''}\n`;
    });
  } else {
    md += `*등록된 Key Spec이 없습니다.*\n`;
  }
  md += `\n`;

  // 4. 🚀 컨텐츠 카드 동적 렌더링
  let contentsSchema = ipData.UI_Schemas?.Contents ? [...ipData.UI_Schemas.Contents] : [...DEFAULT_IP_CONTENTS_SCHEMA];
  
  Object.keys(ipData).forEach(key => {
    if (key.startsWith('Custom_') && !contentsSchema.find(f => f.id === key)) {
       contentsSchema.push({ id: key, label: "추가 항목 (자동 복구됨)", type: "custom" });
    }
  });

  contentsSchema.forEach((field, index) => {
    md += `### 📌 ${index + 1}. ${field.label}\n`;

    if (field.type === 'architecture') {
      if (ipData.Sec1_SubBlocks) md += `- **주요 블록 구성 (SUB-BLOCKS):**\n${String(ipData.Sec1_SubBlocks).trim().split('\n').map(l => `  > ${l}`).join('\n')}\n`;
      if (ipData.Sec1_Lineage) md += `- **상세 설계 계보 (DESIGN LINEAGE):**\n${String(ipData.Sec1_Lineage).trim().split('\n').map(l => `  > ${l}`).join('\n')}\n`;
    } else if (field.type === 'summary') {
      if (ipData.Sec2_Summary) md += `- **원본 IP 핵심 요약:**\n${String(ipData.Sec2_Summary).trim().split('\n').map(l => `  > ${l}`).join('\n')}\n`;
    } else if (field.type === 'focus') {
      if (ipData.Sec3_Focus) md += `- **설계 주안점 및 주의사항:**\n${String(ipData.Sec3_Focus).trim().split('\n').map(l => `  > ${l}`).join('\n')}\n`;
    } else if (field.type === 'custom') {
      const val = ipData[field.id] || '';
      if (String(val).trim()) {
         md += `- **내용:**\n${String(val).trim().split('\n').map(l => `  > ${l}`).join('\n')}\n`;
      } else {
         md += `*내용이 없습니다.*\n`;
      }
    }
    md += `\n`;
  });

  const excludeKeys = [
    'IP_Category', 'IP_Name', 'IP_Status', 'Mother_Project', 'Modification_Level', 'Mother_IP_Index_Path', 'Design_Owner', 'Last_Updated', 'Key_Spec', 'UI_Schemas', 'Sec1_SubBlocks', 'Sec1_Lineage', 'Sec2_Summary', 'Sec3_Focus', 'id',
    'IP_Version', 'Sec4_Revision_History', 
    ...contentsSchema.map(f => f.id)
  ];
  md += renderDynamicFields(ipData, excludeKeys, false);

  md += `---\n\n## 🔗 Linked Issues History (All Stages)\n\n`;
  
  let hasAnyIssue = false;
  const historyBlocks = revLog.historyBlocks || [];
  historyBlocks.forEach(block => {
    const blockIssues = (block.issues || []).filter(i => (i.entryMode === 'new' ? i.ipBlock === ipName : i.targetIssue?.startsWith(ipName + '.')));
    if (blockIssues.length > 0) {
      hasAnyIssue = true;
      md += `### 🕒 Stage: ${block.stageName}\n\n`;
      blockIssues.forEach(i => { md += formatIssueDetails(i, pName); });
    }
  });

  const currentIssues = (revLog.issues || []).filter(i => (i.entryMode === 'new' ? i.ipBlock === ipName : i.targetIssue?.startsWith(ipName + '.')));
  if (currentIssues.length > 0) {
    hasAnyIssue = true;
    md += `### 🎯 Current Stage: ${rev}\n\n`;
    currentIssues.forEach(i => { md += formatIssueDetails(i, pName); });
  }

  if (!hasAnyIssue) md += `*해당 IP에 연동된 이슈 이력이 없습니다.*\n\n`;
  return md;
};

// ─── 3. Revision Log 생성 ───
export const getRevLogMD = (pName, rev, revLog = {}) => {
  let md = `---\ndocument_type: "Revision_Log"\nproject: "${pName}"\nstage: "${rev}"\n---\n\n`;
  md += `# Revision Log: ${pName} (${rev})\n\n> **Exported Date:** ${getToday()}\n\n---\n\n`;
  
  let hasAnyIssue = false;
  const historyBlocks = revLog.historyBlocks || [];
  historyBlocks.forEach(block => {
    if (block.issues?.length > 0) {
      hasAnyIssue = true;
      md += `## 🕒 Stage: ${block.stageName}\n\n`;
      block.issues.forEach(i => { md += formatIssueDetails(i, pName); });
    }
  });

  const currentIssues = revLog.issues || [];
  if (currentIssues.length > 0) {
    hasAnyIssue = true;
    md += `## 🎯 Current Stage: ${rev}\n\n`;
    currentIssues.forEach(i => { md += formatIssueDetails(i, pName); });
  }

  if (!hasAnyIssue) md += `*등록된 이슈 이력이 없습니다.*\n`;
  return md;
};

// ─── 4. FA Report 생성 ───
export const getFaReportMD = (pName, rev, faData = {}) => {
  let md = `---\ndocument_type: "FA_Report"\nproject: "${pName}"\nstage: "${rev}"\n---\n\n`;
  md += `# FA Report: ${pName} (${rev})\n\n---\n\n`;
  const fas = faData.faReports || [];
  if (fas.length === 0) {
    md += `*등록된 FA 리포트가 없습니다.*\n`;
    return md;
  }

  fas.forEach(fa => {
    md += `### 🚨 ${fa.faId} (IP: ${fa.ipBlock})\n`;
    md += renderDynamicFields(fa, ['id', 'faId', 'ipBlock'], true);
    md += `\n`;
  });
  return md;
};