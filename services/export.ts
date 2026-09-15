import { SessionState, Message } from '../types';
import { APP_NAME } from '../constants';

export type ExportFormat = 'pdf' | 'txt' | 'csv' | 'doc';

const formatDate = (date: Date) => date.toLocaleString();

const getSafeFilename = (session: SessionState, extension: string) => {
    const title = session.name || session.customTitle || session.framework?.name || 'Session';
    const dateStr = new Date().toISOString().slice(0, 10);
    return `${APP_NAME.replace(/\s+/g, '-')}-${title.replace(/\s+/g, '_')}-${dateStr}.${extension}`;
};

const downloadBlob = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportSession = (session: SessionState, format: ExportFormat): string => {
    const filename = getSafeFilename(session, format === 'doc' ? 'doc' : format);
    
    switch (format) {
        case 'txt': {
            let content = `${APP_NAME} Session Report\n`;
            content += `Title: ${session.name || session.framework?.name}\n`;
            content += `Date: ${formatDate(new Date())}\n`;
            content += `-------------------------------------------\n\n`;
            session.messages.forEach(msg => {
                content += `[${formatDate(msg.timestamp)}] ${msg.role.toUpperCase()}:\n${msg.text}\n\n`;
            });
            downloadBlob(content, filename, 'text/plain');
            break;
        }
        case 'csv': {
            const headers = ['Timestamp', 'Role', 'Content'];
            const rows = session.messages.map(msg => {
                const safeText = msg.text.replace(/"/g, '""'); // Escape double quotes
                return `"${msg.timestamp.toISOString()}","${msg.role}","${safeText}"`;
            });
            const csvContent = [headers.join(','), ...rows].join('\n');
            downloadBlob(csvContent, filename, 'text/csv');
            break;
        }
        case 'doc': {
            let html = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>${APP_NAME} Report</title>
                <style>
                    body { font-family: 'Calibri', 'Arial', sans-serif; color: #000; }
                    .header { margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .message { margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; background: #f9f9f9; }
                    .role { font-weight: bold; color: #333; margin-bottom: 5px; }
                    .timestamp { font-size: 0.8em; color: #666; font-weight: normal; margin-left: 10px; }
                    .content { white-space: pre-wrap; }
                    .user { background: #e6f3ff; border-color: #b3d7ff; }
                    .model { background: #f0f0f0; border-color: #ccc; }
                </style>
                </head><body>
                <div class="header">
                    <h1>${APP_NAME} Session Report</h1>
                    <p><strong>Topic:</strong> ${session.name || session.framework?.name}</p>
                    <p><strong>Date:</strong> ${formatDate(new Date())}</p>
                </div>
            `;
            session.messages.forEach(msg => {
                html += `
                    <div class="message ${msg.role}">
                        <div class="role">${msg.role.toUpperCase()} <span class="timestamp">${formatDate(msg.timestamp)}</span></div>
                        <div class="content">${msg.text.replace(/\n/g, '<br/>')}</div>
                    </div>
                `;
            });
            html += `</body></html>`;
            downloadBlob(html, filename, 'application/msword');
            break;
        }
        case 'pdf': {
            window.print();
            break;
        }
    }
    return filename;
};