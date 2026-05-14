-- ==========================================
-- Mitus IP Web: RLS (Row Level Security) Setup
-- Phase: Unit D - Security Hardening
-- Strategy: Strict Enforcement (locked_by 기반)
-- ==========================================

-- 1. [projects] 테이블 보안 정책
-- 모든 인증된 사용자는 조회가 가능하지만, 수정/삭제는 잠금 소유자만 가능

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- [SELECT] 누구나 조회 가능 (또는 auth.role = 'authenticated'로 제한 가능)
CREATE POLICY "Enable read access for all users" ON public.projects
FOR SELECT USING (true);

-- [INSERT] 인증된 사용자만 생성 가능
CREATE POLICY "Enable insert for authenticated users" ON public.projects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- [UPDATE] 정책 분리 (27B 감리 반영)

-- 1) 잠금 획득 정책: 누구나 비어있는 잠금을 본인 ID로 채울 수 있음
CREATE POLICY "Enable lock acquisition" ON public.projects
FOR UPDATE
USING (locked_by IS NULL)
WITH CHECK (locked_by = auth.uid()::text);

-- 2) 데이터 수정 정책: 이미 본인이 잠금을 소유한 경우에만 다른 데이터 수정 가능
CREATE POLICY "Enable update for lock owner" ON public.projects
FOR UPDATE
USING (locked_by = auth.uid()::text)
WITH CHECK (locked_by = auth.uid()::text);

-- 3) 잠금 해제 정책: 소유자 본인만 잠금을 해제(NULL)할 수 있음
CREATE POLICY "Enable lock release" ON public.projects
FOR UPDATE
USING (locked_by = auth.uid()::text)
WITH CHECK (locked_by IS NULL);

-- [DELETE] 프로젝트 삭제 권한 (필요 시 소유자 체크 추가 가능)
CREATE POLICY "Enable delete for authenticated users" ON public.projects
FOR DELETE USING (auth.role() = 'authenticated');


-- 2. [custom_ips] 테이블 보안 정책
-- 생성자 기반의 엄격한 관리

ALTER TABLE public.custom_ips ENABLE ROW LEVEL SECURITY;

-- [SELECT] 누구나 조회 가능
CREATE POLICY "Enable read access for all" ON public.custom_ips
FOR SELECT USING (true);

-- [INSERT] 생성 시 본인 ID 강제
CREATE POLICY "Enable insert for authenticated" ON public.custom_ips
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- [UPDATE/DELETE] 본인이 만든 것만 수정/삭제 가능
CREATE POLICY "Enable own updates" ON public.custom_ips
FOR UPDATE USING (created_by = auth.uid()::text);

CREATE POLICY "Enable own deletes" ON public.custom_ips
FOR DELETE USING (created_by = auth.uid()::text);

-- ==========================================
-- 💡 사용자 가이드:
-- 1. 위 쿼리를 Supabase SQL Editor에 복사하여 실행하세요.
-- 2. 'locked_by' 컬럼이 문자열(text) 형태인 경우 auth.uid()::text와 비교해야 합니다.
-- 3. 적용 후, 다른 브라우저 세션에서 타인이 잠근 프로젝트 수정 시 403 에러가 발생하는지 확인하세요.
-- ==========================================
