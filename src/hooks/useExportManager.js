import { useCallback } from 'react';
import JSZip from 'jszip';
import { getOverviewMD, getIpIndexMD, getRevLogMD, getFaReportMD } from '../utils/exportMarkdown';

const useExportManager = ({ activeProject, currentData, currentViewedRevision, projectsList, currentUser, showConfirm }) => {
  const handleSaveMD = useCallback(async () => {
    if (!activeProject || !currentData) {
      showConfirm({ title: "데이터 없음", message: "출력할 데이터가 없습니다.", type: "info", showCancel: false });
      return;
    }
    try {
      const pName = activeProject.name;
      const rev = currentViewedRevision;
      const zip = new JSZip();
      const folder = zip.folder(`${pName}/${rev}`);
      const now = new Date();
      const timeOffset = now.getTimezoneOffset() * 60000;
      const localDate = new Date(now.getTime() - timeOffset);
      const zipOpts = { date: localDate };
      const overviewStr = getOverviewMD(pName, rev, currentData.projectOverview);
      folder.file(`Project_Overview.${pName}.${rev}.md`, overviewStr, zipOpts);
      const ips = currentData.projectOverview?.IP_Blocks || [];
      ips.forEach(ip => {
        const ipData = currentData.ipIndex?.[ip] || {};
        const ipStr = getIpIndexMD(pName, rev, ip, ipData, currentData.revisionLog);
        folder.file(`IP_Index.${ip}.${pName}.${rev}.md`, ipStr, zipOpts);
      });
      const revLogStr = getRevLogMD(pName, rev, currentData.revisionLog);
      folder.file(`Revision_Log.${pName}.${rev}.md`, revLogStr, zipOpts);
      const faStr = getFaReportMD(pName, rev, currentData.faReport);
      folder.file(`FA_Report.${pName}.${rev}.md`, faStr, zipOpts);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pName}_${rev}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      showConfirm({ title: "내보내기 오류", message: "Markdown Export 중 오류가 발생했습니다: " + err.message, type: "danger", showCancel: false });
      console.error(err);
    }
  }, [activeProject, currentData, currentViewedRevision, showConfirm]);

  const handleExportProject = useCallback(async (projectId) => {
    const proj = projectsList.find(p => p.id === projectId);
    if (!proj) return;
    try {
      const exportData = {
        app: "Mitus-IP-Web", version: "1.0",
        export_at: new Date().toISOString(), exported_by: currentUser,
        project: { id: proj.id, name: proj.name, phases: proj.phases, latest_evt: proj.latest_evt, is_archived: proj.is_archived, project_data: proj.project_data }
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      const safeName = (proj.name || proj.id).replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s]/gi, '_').trim();
      link.download = `Mitus_Project_${safeName}_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      showConfirm({ title: "내보내기 오류", message: "JSON 데이터 내보내기 중 오류가 발생했습니다: " + err.message, type: "danger", showCancel: false });
    }
  }, [projectsList, currentUser, showConfirm]);

  return { handleSaveMD, handleExportProject };
};

export default useExportManager;
