// src/data/mockData.js

export const defaultProjOverview = {
        Project_Name: 'SM5718', Foundry: 'SSF', Process: 'BCD1340HP', OSAT_Partner: ['ASE_Korea'], Mother_Project: 'SM5714B',
        Customer_Name: 'Samsung', Target_Application: 'Mobile',
        Organization: { Design_Team: 'Mobile Design Group 1\nDigital Design Group', Designers: '박OO (PL)\n최OO (Buck)\n이OO (Protection)', ATE: '박OO', QE: '김OO', FAE: '유OO' },
        Specs: { Operating_Voltage: '3.0V - 16V', Switching_Frequency: '1MHz - 3MHz', Quiescent_current: '100uA', Chip_Area_Target: '12.5mm2', Package: 'WLCSP' },
        TO_Dates: { 'EVT0': '2025.10.10', 'EVT1': '2026.02.01' },
        IP_Blocks: ['Buck', 'Fuel_Gauge', 'Type-C'],
        Body_1_KeyFeatures: '- Max. 15W Switch-Mode Charger with dual-output\n- Max. 9W OTG reverse boost mode\n- 3:1 MUX switches with Built-in BC 1.2 Protocol',
        Body_2_Specs: '| Item               | Specification | Unit | Remarks          |\n| :----------------- | :------------ | :--- | :--------------- |\n| Input Voltage  | 3.0 ~ 4.5     | V    | Battery Direct   |\n| I/O Logic      | 1.8 / 1.2     | V    | Dual-Voltage     |\n| Operating Temp | -40 ~ 125     | °C   | Automotive Grade |',
        Body_3_DesignFocus: '- Power Sharing: Seamless mode transition between Buck and Boost\n- Power: Sub-uA Leakage in SHIP_MODE\n- Reliability: Improve ESD',
        Body_4_Milestones: '- Kick-off: 2026-03-01\n- EVT0 TO: 2026-05-15\n- EVT1 TO: 2026-08-30',
        Body_5_References: '### Technical Specifications\n* [Datasheet_SM5718_v1.0.pdf](./Attachments/Specs/Datasheet_SM5718_v1.0.pdf)'
};

/**
 * 신규 프로젝트 생성 시 사용할 빈 Overview 팩토리.
 * defaultProjOverview와 동일한 구조(키)를 유지하되 모든 값을 비웁니다.
 * @param {object} formInput - NewProjectModal에서 입력한 값
 */
export const makeBlankOverview = (formInput = {}) => ({
  Project_Name:        formInput.Project_Name        || '',
  Customer_Name:       formInput.Customer_Name       || '',
  Target_Application:  formInput.Target_Application  || '',
  Foundry:             formInput.Foundry             || '',
  Process:             formInput.Process             || '',
  OSAT_Partner:        [],
  Mother_Project:      '',
  IP_Blocks:           formInput.IP_Blocks           || [],
  Organization: { Design_Team: '', Designers: '', ATE: '', QE: '', FAE: '' },
  Specs: { Operating_Voltage: '', Switching_Frequency: '', Quiescent_current: '', Chip_Area_Target: '', Package: '' },
  TO_Dates:            {},
  Body_1_KeyFeatures:  '',
  Body_2_Specs:        '',
  Body_3_DesignFocus:  '',
  Body_4_Milestones:   '',
  Body_5_References:   '',
});

export const defaultIpIndexMap = {
        "Buck": {
          IP_Category: "Power_Management", IP_Name: "Buck", IP_Version: "EVT0", IP_Status: "Active",
          Mother_Project: "SM5714B", Mother_IP_Index_Path: "~~//IP_Index.Buck.SM5714B.EVT10.md", Modification_Level: "Major",
          Key_Spec: { "Control_Scheme": "Peak_Current_Mode, PFM", "Operation_Voltage_Min": "2.8V", "Operation_Voltage_Max": "16V", "Switching_Frequency_Min": "500kHz", "Switching_Frequency_Max": "2.4MHz", "Vout_Range_Min": "3.0V", "Vout_Range_Max": "5.2V", "Iout_Max": "5A", "Efficiency_Target": "92%" },
          Design_Owner: "박OO", Last_Updated: "2026-04-10",
          Sub_Blocks: [
            { id: "sb_1", name: "Gate_Driver", motherProject: "SM5714B", motherIpName: "GD_Buck_v2", modificationLevel: "Reuse", keyFeatures: "High-side FET 턴온 속도 최적화, Cross-conduction 방지 로직 내장" },
            { id: "sb_2", name: "OCP_Block", motherProject: "SM5713", motherIpName: "OCP_Logic_v1", modificationLevel: "Minor", keyFeatures: "디지털 블랭킹 타임 조절 가능 (200ns~1us), 펄스 단위 전류 제한" },
            { id: "sb_3", name: "Current_Sensor", motherProject: "SM5720", motherIpName: "CS_Sensing_v3", modificationLevel: "Major", keyFeatures: "고정밀 Bi-directional 센싱, 온도 보상 회로 탑재로 오차 ±3% 이내" },
            { id: "sb_4", name: "Error_Amp", motherProject: "SM5714B", motherIpName: "EA_OTA_HighGain_v1", modificationLevel: "Reuse", keyFeatures: "Low-offset OTA, 80dB Open-loop Gain, Phase margin 60도 확보" },
            { id: "sb_5", name: "PWM_Logic", motherProject: "SM5718", motherIpName: "COT_PWM_v1", modificationLevel: "New", keyFeatures: "Constant On-Time 제어 방식, PFM-PWM 자동 전환 로직, 울트라 로드 과도응답 개선" }
          ],
          Sec1_SubBlocks: "- **Error_Amp:** Low-offset high-gain OTA\n- **PWM_Logic:** COT controller\n- **Power_Stage:** Integrated N-ch MOSFETs\n- **Protections:** OVP, OCP, OTP",
          Sec1_Lineage: "- **Mother IP:** Buck.SM5714B.EVT10\n- **주요 변경점:**\n\t- 스위칭 주파수 최적화\n\t- Bi-directional Current sensor",
          Sec2_Summary: "- **과거 핵심 주의사항:** Switching frequency가 경쟁사 대비 높음\n- **과거 설계 인사이트:** 라이트 로드 효율 개선 위해 PFM 모드 최적화 필요",
          Sec3_Focus: "- Power sharing mode 구현을 위한 Bi-direction current sensor\n- 경쟁사와 동등한 효율 특성을 위한 switching frequency 최적화",
          Sec4_Revision_History: "*Revision_Log.md 파일 연동 후 데이터가 이곳에 표시됩니다.*"
        }
      };

export const REVISION_LOG_SEED = {
      'SM5718': {
        'EVT1': {
          initialMode: 'new',
          loadedIssues: [],
          historyBlocks: [],
          issues: [
            { id: 101, ipBlock: 'Buck', subBlock: 'Gate_Driver', issueNum: 'ISSUE#1', entryMode: 'new', types: ['Initial'], severity: 'Major', disposition: 'Revision', phenomenon: 'High-side FET turn-on speed too slow causing cross-conduction risk.', rootCause: 'Driver strength insufficient for high Qg power FETs used in SM5718.', assignee: '김OO', stage: 'EVT1' },
            { id: 102, ipBlock: 'Buck', subBlock: 'Current_Sensor', issueNum: 'ISSUE#2', entryMode: 'new', types: ['Initial'], severity: 'Major', disposition: 'Revision', phenomenon: 'Iout telemetry shows +15% offset error at low load (< 500mA).', rootCause: 'Sense resistor layout asymmetry causing parasitic voltage drop.', assignee: '이OO', stage: 'EVT1' },
            { id: 103, ipBlock: 'Buck', subBlock: null, issueNum: 'ISSUE#3', entryMode: 'new', types: ['Initial'], severity: 'Minor', disposition: 'Test Screening', phenomenon: 'Overall system efficiency 2% lower than target at full load.', rootCause: 'Package bonding wire resistance higher than simulation model.', assignee: '박OO', stage: 'EVT1' },
          ]
        },
        'EVT2': {
          initialMode: 'eval',
          loadedIssues: ['Buck.SM5718.ISSUE#1', 'Buck.SM5718.ISSUE#2', 'Type-C.SM5718.ISSUE#1'],
          issues: [
            { id: 2001, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#1', assessment: 'Fixed', comment: '의도대로 수정 완료 확인', attachments: '', assignee: '홍길동', severity: 'Major', phenomenon: '', rootCause: '', disposition: 'Acceptable', justification: '', modPlan: '', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', types: [] },
            { id: 2002, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#2', assessment: 'Partial', comment: '일부 개선되었으나 온도 조건에서 재발 가능성 있음', attachments: '', assignee: '홍길동', severity: 'Minor', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '온도 보상 로직 추가 검토', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '', types: [] },
            { id: 2003, entryMode: 'reopen', targetIssue: 'Buck.SM5718.ISSUE#3', previousStateSummary: 'Disposition was [SW Workaround]', reopenReason: 'ATE test 결과 예상보다 yield drop이 커서 리비젼을 하기로 결정함', severity: 'Marginal', phenomenon: 'ㅇㅇㅇ', rootCause: 'ㄷㄷㄷㄷ', disposition: 'Revision', justification: '', modPlan: '바이어스 전류 재설계', customerAlignment: 'Internal Only', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '', types: [] },
            { id: 2004, entryMode: 'eval', targetIssue: 'Type-C.SM5718.ISSUE#1', assessment: 'Fixed', comment: '', attachments: '', assignee: '홍길동', severity: 'Major', phenomenon: '', rootCause: '', disposition: 'Acceptable', justification: '', modPlan: '', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', types: [] },
          ],
          historyBlocks: [
            {
              stageName: 'EVT1', issues: [
                { id: 2101, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#1', types: ['Initial'], severity: 'Major', phenomenon: '리플과다', rootCause: '회로설계오류', disposition: 'Revision', justification: '', modPlan: '타이밍 최적화', customerAlignment: 'Aligned', customerReportType: 'Sanitized', sanitizedStory: 'ㅇㅇㅇㅇㅇ', customerFacingAttachments: 'ㅇㅇㅇㅇㅇㅇㅇㄹㄴㅁㄷㄹㅇ', customerAlignmentDetails: 'ㄹㄷㄹㄷㅈㄷㄹㅇㄹㅇ', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
                { id: 2102, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#2', types: ['Customer request'], severity: 'Minor', phenomenon: '동작범위 개선', rootCause: '고객요구사항', disposition: 'Revision', justification: 'ㅇㅇㅇㅇ', modPlan: 'ㅇㅇㅇㅇ', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
                { id: 2103, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#3', types: ['Initial'], severity: 'Marginal', phenomenon: 'ㅇㅇㅇ', rootCause: 'ㄷㄷㄷㄷ', disposition: 'SW Workaround', justification: 'ㅇㅇㅇㅇ', modPlan: '', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
                { id: 2104, entryMode: 'new', ipBlock: 'Type-C', issueNum: 'ISSUE#1', types: ['Initial'], severity: 'Fail', phenomenon: 'Water Detection 오동작', rootCause: 'ㅇㅇㅇㅇ', disposition: 'Revision', justification: 'ㅇㅇㅇㅇ', modPlan: 'ㅇㅇㅇㅇ', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
              ]
            }
          ]
        },
        'EVT3': {
          initialMode: 'eval',
          loadedIssues: ['Buck.SM5718.ISSUE#2', 'Buck.SM5718.ISSUE#3'],
          issues: [
            { id: 3001, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#2', assessment: 'Deferred', comment: 'EVT4와 병렬 진행 중. 대책 A(온도 보상 커패시터 추가)를 본 차수에 적용함. EVT4와 종합 비교 후 EVT5에서 최종 판단 예정.', attachments: '', assignee: '홍길동', severity: 'Minor', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', deferReason: 'EVT4 병렬 테이프아웃 진행 중 — 대책 방향이 상이하여 결과 비교 후 최종 채택 필요', expectedResolutionStage: 'EVT5', relatedParallelStage: 'EVT4', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', types: [] },
            { id: 3002, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#3', assessment: 'Deferred', comment: 'EVT4와 동시에 서로 다른 바이어스 조건으로 테이프아웃. 두 결과를 비교하여 EVT5에서 최종 수정 방향 결정.', attachments: '', assignee: '홍길동', severity: 'Marginal', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', deferReason: '대책 A(바이어스 전류 증가) 적용 중, EVT4 대책 B(레이아웃 재설계)와 병렬 평가 중', expectedResolutionStage: 'EVT5', relatedParallelStage: 'EVT4', customerAlignment: 'Internal Only', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', types: [] },
          ],
          historyBlocks: [
            {
              stageName: 'EVT2', issues: [
                { id: 3101, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#1', assessment: 'Fixed', comment: '의도대로 수정 완료 확인', attachments: '', assignee: '홍길동', severity: 'Major', phenomenon: '', rootCause: '', disposition: 'Acceptable', justification: '', modPlan: '', types: [] },
                { id: 3102, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#2', assessment: 'Partial', comment: '일부 개선되었으나 온도 조건에서 재발 가능성 있음', attachments: '', assignee: '홍길동', severity: 'Minor', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '온도 보상 로직 추가 검토', types: [] },
                { id: 3103, entryMode: 'reopen', targetIssue: 'Buck.SM5718.ISSUE#3', previousStateSummary: 'Disposition was [SW Workaround]', reopenReason: 'ATE test yield drop으로 리비젼 결정', attachments: '', assignee: '홍길동', severity: 'Marginal', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '바이어스 전류 재설계', types: [] },
                { id: 3104, entryMode: 'eval', targetIssue: 'Type-C.SM5718.ISSUE#1', assessment: 'Fixed', comment: '', attachments: '', assignee: '홍길동', severity: 'Major', phenomenon: '', rootCause: '', disposition: 'Acceptable', justification: '', modPlan: '', types: [] },
              ]
            },
            {
              stageName: 'EVT1', issues: [
                { id: 3201, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#1', types: ['Initial'], severity: 'Major', phenomenon: '리플과다', rootCause: '회로설계오류', disposition: 'Revision', justification: '', modPlan: '타이밍 최적화', customerAlignment: 'Aligned', customerReportType: 'Sanitized', sanitizedStory: 'ㅇㅇㅇㅇㅇ', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
                { id: 3202, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#2', types: ['Customer request'], severity: 'Minor', phenomenon: '동작범위 개선', rootCause: '고객요구사항', disposition: 'Revision', justification: 'ㅇㅇㅇㅇ', modPlan: 'ㅇㅇㅇㅇ', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
                { id: 3203, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#3', types: ['Initial'], severity: 'Marginal', phenomenon: 'ㅇㅇㅇ', rootCause: 'ㄷㄷㄷㄷ', disposition: 'SW Workaround', justification: 'ㅇㅇㅇㅇ', modPlan: '', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
                { id: 3204, entryMode: 'new', ipBlock: 'Type-C', issueNum: 'ISSUE#1', types: ['Initial'], severity: 'Fail', phenomenon: 'Water Detection 오동작', rootCause: 'ㅇㅇㅇㅇ', disposition: 'Revision', justification: 'ㅇㅇㅇㅇ', modPlan: 'ㅇㅇㅇㅇ', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
              ]
            }
          ]
        },
        'EVT4': {
          initialMode: 'eval',
          loadedIssues: ['Buck.SM5718.ISSUE#2', 'Buck.SM5718.ISSUE#3'],
          issues: [
            { id: 4001, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#2', assessment: 'Deferred', comment: 'EVT3과 병렬 진행. 대책 B(피드백 루프 재설계)를 적용함. 단독으로는 개선 확인되나, EVT3 결과와 종합하여 EVT5에서 최종 판단.', attachments: '', assignee: '홍길동', severity: 'Minor', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', deferReason: 'EVT3 병렬 테이프아웃 진행 중 — EVT5에서 두 대책 비교 후 최종 채택 결정 예정', expectedResolutionStage: 'EVT5', relatedParallelStage: 'EVT3', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', types: [] },
            { id: 4002, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#3', assessment: 'Deferred', comment: '대책 B(레이아웃 재설계 + 더미 셀 추가) 적용. EVT3 대책 A 대비 yield 개선 효과가 더 크게 측정됨. EVT5에서 최종 채택 확정 예정.', attachments: '', assignee: '홍길동', severity: 'Marginal', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', deferReason: 'EVT3 대책 A 결과와 비교 중, EVT5에서 최적 대책 채택 결정 예정', expectedResolutionStage: 'EVT5', relatedParallelStage: 'EVT3', customerAlignment: 'Internal Only', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', types: [] },
          ],
          historyBlocks: [
            {
              stageName: 'EVT3', issues: [
                { id: 4101, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#2', assessment: 'Deferred', comment: 'EVT4와 병렬 진행 중, 대책 A 적용.', deferReason: 'EVT4와 병렬 테이프아웃', expectedResolutionStage: 'EVT5', relatedParallelStage: 'EVT4', attachments: '', assignee: '홍길동', severity: 'Minor', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', types: [] },
                { id: 4102, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#3', assessment: 'Deferred', comment: 'EVT4와 동시 평가 중, 대책 A(바이어스 전류 증가) 적용.', deferReason: '대책 A vs 대책 B 비교 중', expectedResolutionStage: 'EVT5', relatedParallelStage: 'EVT4', attachments: '', assignee: '홍길동', severity: 'Marginal', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', types: [] },
              ]
            },
            {
              stageName: 'EVT2', issues: [
                { id: 4201, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#1', assessment: 'Fixed', comment: '의도대로 수정 완료 확인', attachments: '', assignee: '홍길동', severity: 'Major', phenomenon: '', rootCause: '', disposition: 'Acceptable', justification: '', modPlan: '', types: [] },
                { id: 4202, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#2', assessment: 'Partial', comment: '일부 개선, 온도 조건 재발 가능성', attachments: '', assignee: '홍길동', severity: 'Minor', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', types: [] },
                { id: 4203, entryMode: 'eval', targetIssue: 'Type-C.SM5718.ISSUE#1', assessment: 'Fixed', comment: '', attachments: '', assignee: '홍길동', severity: 'Major', phenomenon: '', rootCause: '', disposition: 'Acceptable', justification: '', modPlan: '', types: [] },
              ]
            },
            {
              stageName: 'EVT1', issues: [
                { id: 4301, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#1', types: ['Initial'], severity: 'Major', phenomenon: '리플과다', rootCause: '회로설계오류', disposition: 'Revision', justification: '', modPlan: '타이밍 최적화', customerAlignment: 'Aligned', customerReportType: 'Sanitized', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
                { id: 4302, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#2', types: ['Customer request'], severity: 'Minor', phenomenon: '동작범위 개선', rootCause: '고객요구사항', disposition: 'Revision', justification: '', modPlan: '', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
                { id: 4303, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#3', types: ['Initial'], severity: 'Marginal', phenomenon: 'ㅇㅇㅇ', rootCause: 'ㄷㄷㄷㄷ', disposition: 'SW Workaround', justification: '', modPlan: '', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
              ]
            }
          ]
        },
        'EVT5': {
          initialMode: 'eval',
          loadedIssues: ['Buck.SM5718.ISSUE#2', 'Buck.SM5718.ISSUE#3'],
          issues: [
            { id: 5001, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#2', assessment: 'Fixed', comment: 'EVT3(대책 A) vs EVT4(대책 B) 종합 판단 완료. EVT4의 피드백 루프 재설계 방안이 전 온도 범위에서 안정적임을 확인. 대책 B 채택하여 최종 Fix 판정.', attachments: '', assignee: '홍길동', severity: 'Minor', phenomenon: '', rootCause: '', disposition: 'Acceptable', justification: '', modPlan: '', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', types: [] },
            { id: 5002, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#3', assessment: 'Fixed', comment: 'EVT4 대책 B(레이아웃 재설계 + 더미 셀 추가)에서 yield 98.7%로 목표치 달성 확인. EVT3 대책 A(바이어스 전류 증가) 대비 yield 4.2% 우세. 대책 B 채택, 최종 Fix 판정.', attachments: '', assignee: '홍길동', severity: 'Marginal', phenomenon: '', rootCause: '', disposition: 'Acceptable', justification: '', modPlan: '', customerAlignment: 'Internal Only', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', types: [] },
          ],
          historyBlocks: [
            {
              stageName: 'EVT4', issues: [
                { id: 5101, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#2', assessment: 'Deferred', comment: 'EVT3과 병렬 진행. 대책 B 적용.', deferReason: 'EVT3 병렬 테이프아웃, EVT5에서 최종 판단', expectedResolutionStage: 'EVT5', relatedParallelStage: 'EVT3', attachments: '', assignee: '홍길동', severity: 'Minor', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', types: [] },
                { id: 5102, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#3', assessment: 'Deferred', comment: '대책 B 적용, EVT5에서 최종 채택 결정 예정.', deferReason: 'EVT3 대책 A 결과와 비교 중', expectedResolutionStage: 'EVT5', relatedParallelStage: 'EVT3', attachments: '', assignee: '홍길동', severity: 'Marginal', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', types: [] },
              ]
            },
            {
              stageName: 'EVT3', issues: [
                { id: 5201, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#2', assessment: 'Deferred', comment: '대책 A 적용, EVT4와 종합 판단 예정.', deferReason: 'EVT4 병렬 테이프아웃', expectedResolutionStage: 'EVT5', relatedParallelStage: 'EVT4', attachments: '', assignee: '홍길동', severity: 'Minor', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', types: [] },
                { id: 5202, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#3', assessment: 'Deferred', comment: '대책 A(바이어스 전류 증가) 적용.', deferReason: '대책 A vs B 비교 중', expectedResolutionStage: 'EVT5', relatedParallelStage: 'EVT4', attachments: '', assignee: '홍길동', severity: 'Marginal', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', types: [] },
              ]
            },
            {
              stageName: 'EVT2', issues: [
                { id: 5301, entryMode: 'eval', targetIssue: 'Buck.SM5718.ISSUE#2', assessment: 'Partial', comment: '일부 개선, 온도 조건 재발 가능성', attachments: '', assignee: '홍길동', severity: 'Minor', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '', types: [] },
                { id: 5302, entryMode: 'reopen', targetIssue: 'Buck.SM5718.ISSUE#3', previousStateSummary: 'Disposition was [SW Workaround]', reopenReason: 'yield drop으로 리비젼 결정', attachments: '', assignee: '홍길동', severity: 'Marginal', phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '바이어스 전류 재설계', types: [] },
              ]
            },
            {
              stageName: 'EVT1', issues: [
                { id: 5401, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#2', types: ['Customer request'], severity: 'Minor', phenomenon: '동작범위 개선', rootCause: '고객요구사항', disposition: 'Revision', justification: '', modPlan: '', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
                { id: 5402, entryMode: 'new', ipBlock: 'Buck', issueNum: 'ISSUE#3', types: ['Initial'], severity: 'Marginal', phenomenon: 'ㅇㅇㅇ', rootCause: 'ㄷㄷㄷㄷ', disposition: 'SW Workaround', justification: '', modPlan: '', customerAlignment: 'Aligned', customerReportType: 'Transparent', sanitizedStory: '', customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '홍길동', origin: '', escapeReason: '', sideEffectSource: '' },
              ]
            }
          ]
        }
      }
    };


export const FA_REPORT_SEED = {
  'SM5718': {
    'EVT1': {
      faReports: []
    },
    'EVT2': {
      faReports: [
        {
          faId: 'FA-SM5718-EVT2-001',
          ipBlock: 'Buck',
          subBlock: 'PWM_Logic',
          sampleSourceVer: 'EVT1',
          reportedInStage: 'EVT2',
          versionGap: 'Fixed in Latest',
          customer: '삼성전자',
          custStage: 'ES',
          severity: 'S1',
          phenomenon: 'Light load jitter (PWM switching jitter) observed in PFM-PWM transition region.',
          rootCause: 'COT timer logic unstable during rapid feedback voltage change.',
          disposition: 'Revision',
          reportLink: 'https://internal.mitus.com/fa/SM5718/EVT2/001',
          isLinkedToLog: false,
        },
        {
          faId: 'FA-SM5718-EVT2-002',
          ipBlock: 'Buck',
          subBlock: 'OCP_Block',
          sampleSourceVer: 'EVT2',
          reportedInStage: 'EVT2',
          versionGap: 'Fixed in Latest',
          customer: '삼성전자',
          custStage: 'ES',
          severity: 'S2',
          phenomenon: 'OCP false triggering during heavy load step (0.5A to 4.5A).',
          rootCause: 'OCP blanking time too short for inductor current ringing.',
          disposition: 'Workaround',
          reportLink: 'https://internal.mitus.com/fa/SM5718/EVT2/002',
          isLinkedToLog: false,
        },
        {
          faId: 'FA-SM5718-EVT2-003',
          ipBlock: 'Type-C',
          sampleSourceVer: 'EVT1',
          reportedInStage: 'EVT2',
          versionGap: 'Potential Risk',
          customer: '삼성전자',
          custStage: 'CS',
          severity: 'S2',
          phenomenon: 'Water Detection 기능이 고습도 환경(85% RH) 에서 간헐적으로 오동작. USB 연결 불가 현상 발생.',
          rootCause: 'Water Detection 판단 기준 저항값이 고습도 환경에서 드리프트 발생. 비교 기준 전압 재설정 필요.',
          disposition: 'Screening',
          reportLink: 'https://internal.mitus.com/fa/SM5718/EVT2/003',
          isLinkedToLog: false,
        },
      ]
    }
  }
};

export const initialProjectData = {
    projectId: "SM5718",
    revisions: {
        "EVT1": {
            status: "archived", // 이전 차수는 잠금 상태
            projectOverview: JSON.parse(JSON.stringify(defaultProjOverview)),
            ipIndex: JSON.parse(JSON.stringify(defaultIpIndexMap)),
            revisionLog: JSON.parse(JSON.stringify(REVISION_LOG_SEED['SM5718']['EVT1'])),
            faReport: JSON.parse(JSON.stringify(FA_REPORT_SEED['SM5718']['EVT1']))
        },
        "EVT2": {
            status: "draft", // 현재 작업 중인 차수
            projectOverview: JSON.parse(JSON.stringify(defaultProjOverview)),
            ipIndex: JSON.parse(JSON.stringify(defaultIpIndexMap)),
            revisionLog: JSON.parse(JSON.stringify(REVISION_LOG_SEED['SM5718']['EVT2'])),
            faReport: JSON.parse(JSON.stringify(FA_REPORT_SEED['SM5718']['EVT2']))
        }
    }
};

export const foundryProcessMap = {
      'SSF': ['BCD1340HP', 'BCD1370', 'APM1345'],
      'DBH': ['1530BD13SA', 'DB130LVA'],
      'HYNIX': ['HB130GNH', 'HB180ELL', 'HB180EN', 'HB180ENH']
    };

export const ipCategoryNameMap = {
      'Power_Regulation': ['Buck', 'Boost', 'LDO', 'Charge_Pump', 'Buck-Boost'],
      'Power_Management': ['Battery_Charger', 'Fuel_Gauge', 'Power_Sequencer', 'DVS', 'PMIC'],
      'Supervisory_Protection': ['Bandgap_Reference', 'UVLO', 'OVP', 'OCP', 'OTP', 'POR', 'Voltage_Monitor'],
      'Data_Converter': ['ADC', 'DAC'],
      'Interface_MixedSignal': ['I2C_PHY', 'SPI_PHY', 'Comparator', 'SerDes', 'Audio_Codec'],
      'Clocking_Timing': ['Oscillator', 'PLL'],
      'Digital_Logic': ['Microcontroller', 'DSP', 'Standard_Logic', 'Timer', 'Watchdog'],
      'Sensors': ['Temp_Sensor', 'Current_Sensor', 'Hall_Sensor']
    };

export const makeDefaultIpIndex = (ipName, evt) => ({
        IP_Category: "Power_Management", IP_Name: ipName || "Buck", IP_Version: evt || "EVT0", IP_Status: "Active",
        Mother_Project: "SM5714B", Mother_IP_Index_Path: "", Modification_Level: "Major",
        Key_Spec: { "Control_Scheme": "", "Operation_Voltage_Min": "", "Operation_Voltage_Max": "", "Switching_Frequency_Min": "", "Switching_Frequency_Max": "", "Vout_Range_Min": "", "Vout_Range_Max": "", "Iout_Max": "", "Efficiency_Target": "" },
        Design_Owner: "", Last_Updated: new Date().toISOString().split('T')[0],
        Sub_Blocks: [],
        Sec1_SubBlocks: "", Sec1_Lineage: "", Sec2_Summary: "", Sec3_Focus: "",
        Sec4_Revision_History: "*Revision_Log.md 파일 연동 후 데이터가 이곳에 표시됩니다.*"
      });
