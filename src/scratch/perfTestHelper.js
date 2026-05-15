import { supabase } from '../supabaseClient';

/**
 * 성능 측정을 위한 대용량 더미 데이터 생성 헬퍼
 * 사용법: window.injectPerfTestData('프로젝트명 또는 ID', 1000)
 */
export async function injectPerfTestData(identifier, count = 1000) {
    console.log(`🚀 [PerfTest] '${identifier}' 프로젝트 진단 및 캐시 클린업 시작...`);
    
    // 1. ID 또는 이름으로 프로젝트 찾기
    const { data: projects, error: searchError } = await supabase
        .from('projects')
        .select('*')
        .or(`id.eq.${identifier},name.eq.${identifier}`);

    if (searchError || !projects || projects.length === 0) {
        console.error('❌ 프로젝트를 찾을 수 없습니다.');
        return;
    }

    const project = projects[0];
    const projectData = project.project_data || {};
    
    // ID 생성에 필요한 정확한 정보 추출
    const realProjName = projectData.overview?.Project_Name || project.name;
    const currentEvt = project.latest_evt || project.evt || 'EVT0';
    const ips = projectData.overview?.IP_Blocks || ['Common'];
    
    console.log(`📍 대상 확인: ${project.name} (ID: ${project.id})`);
    console.log(`📍 사용될 프로젝트명: ${realProjName}`);
    console.log(`📍 현재 차수(EVT): ${currentEvt}`);

    // 2. 더미 이슈 생성 (기존꺼 포함하지 않고 새로 깨끗하게 주입)
    const dummyIssues = [];
    for (let i = 0; i < count; i++) {
        dummyIssues.push({
            entryMode: 'new',
            ipBlock: ips[0], 
            issueNum: `PERF-${i}`,
            types: ['Initial'],
            severity: 'Minor',
            phenomenon: `[PerfTest] 성능 측정 이슈 #${i} (차수: ${currentEvt})`,
            rootCause: `대용량 데이터 처리 성능 테스트 중...`,
            comment: `데이터 개수: ${count}`,
            disposition: 'OPEN',
            assignee: 'Tester',
            date: new Date().toISOString().split('T')[0],
            stage: currentEvt,
            projectName: realProjName
        });
    }

    // 3. 강제 업데이트
    console.log(`⌛ ${count}개 데이터 생성 완료. DB 주입 및 캐시 파기 중...`);
    const { error: updateError } = await supabase
        .from('projects')
        .update({ 
            project_data: { 
                ...projectData, 
                issues: dummyIssues // 기존 이슈 덮어쓰기 (테스트용)
            },
            updated: new Date().toISOString()
        })
        .eq('id', project.id);

    if (updateError) {
        console.error('❌ DB 업데이트 실패:', updateError);
    } else {
        console.log(`✅ 성공! '${project.name}'에 ${count}개의 이슈가 새로 주입되었습니다.`);
        
        // 4. 로컬 스토리지 캐시 강제 삭제
        localStorage.removeItem('mitus_project_cache');
        console.log(`🧹 로컬 캐시(mitus_project_cache)를 성공적으로 비웠습니다.`);
        console.log(`👉 이제 대시보드로 나갔다가 다시 '${project.name}' 프로젝트에 들어오세요!`);
    }
}

window.injectPerfTestData = injectPerfTestData;

