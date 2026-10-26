import { useMemo, useRef, useState } from 'react';
import memberService from '../../services/memberService';
import './BulkImportModal.css';

const HEADERS = ['firstName', 'lastName', 'email', 'gender', 'birthDate', 'maritalStatus', 'membershipType', 'believerStatus', 'joinDate', 'memberSince', 'mobileNumber', 'landlineNumber', 'lifeGroupName', 'role'];
const IMPORTABLE_ROLES = new Set(['member', 'core_team', 'lg_leader', 'assistantlg_leader', 'unit_leader', 'assistantunit_leader', 'subdistrict_leader']);

const parseCsv = (text) => {
  const records = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i += 1; } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value.trim()); value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value.trim()); value = '';
      if (row.some(Boolean)) records.push(row);
      row = [];
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) records.push(row);
  return records;
};

const readMembers = (text) => {
  const records = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!records.length) throw new Error('The CSV file is empty.');
  const headers = records[0].map(header => header.trim());
  const missing = ['firstName', 'lastName', 'email'].filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`);
  return records.slice(1).map(columns => Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? ''])));
};

const previewErrors = members => members.flatMap((member, index) => {
  const problems = [];
  if (!member.firstName) problems.push('first name required');
  if (!member.lastName) problems.push('last name required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email || '')) problems.push('valid email required');
  if (!member.lifeGroupName) problems.push('life group name required');
  if (member.role && !IMPORTABLE_ROLES.has(member.role.toLowerCase())) problems.push('role cannot be bulk imported');
  return problems.length ? [{ row: index + 2, message: problems.join(', ') }] : [];
});

const downloadTemplate = () => {
  const examples = [
    ['Jane', 'Tan', 'jane@example.com', 'Female', '31-01-2000', 'Single', 'Member', '', '01-01-2026', '0123456789', '', 'Hope Life Group', 'member'],
    ['John', 'Lim', 'john@example.com', 'Male', '15-06-2002', 'Single', 'Visitor', 'Believer', '10-02-2026', '0198765432', '', 'Hope Life Group', 'lg_leader'],
  ];
  const csv = [HEADERS, ...examples].map(row => row.join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`${csv}\r\n`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'member-import-template.csv'; link.click();
  URL.revokeObjectURL(url);
};

const BulkImportModal = ({ onClose, onImported }) => {
  const fileRef = useRef(null);
  const [members, setMembers] = useState([]);
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => members.slice(0, 8), [members]);

  const selectFile = async (event) => {
    const file = event.target.files?.[0];
    setMessage(''); setErrors([]); setMembers([]);
    if (!file) return;
    try {
      const parsed = readMembers(await file.text());
      if (parsed.length > 500) throw new Error('A maximum of 500 members can be imported at once.');
      setFileName(file.name); setMembers(parsed); setErrors(previewErrors(parsed));
    } catch (err) { setFileName(file.name); setMessage(err.message); }
  };

  const runImport = async () => {
    setSaving(true); setMessage(''); setErrors([]);
    try {
      const response = await memberService.bulkImport(members);
      setMessage(response.data?.message || `${members.length} members imported.`);
      setMembers([]); setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      onImported();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Import failed. No members were imported.');
      setErrors(err.response?.data?.errors || []);
    } finally { setSaving(false); }
  };

  return <div className="modal-overlay" onClick={onClose}>
    <div className="modal modal--wide bulk-import" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
      <div className="modal__header">
        <div><h2 className="modal__title">Bulk Import Members</h2><p className="modal__subtitle bulk-import__note">Every imported member receives a member account using the shared default password.</p></div>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="bulk-import__body">
        <section className="bulk-import__section">
          <div className="bulk-import__section-head"><h3>Prepare CSV</h3><button type="button" className="btn btn--ghost btn--sm" onClick={downloadTemplate}>Download template</button></div>
          <p>1. Required: firstName, lastName, email, lifeGroupName.</p>
          <p>2. Dates use DD-MM-YYYY.</p>
          <p>3. Enter the exact active life group name within your permitted scope.</p>
          <div className="bulk-import__instructions">
            <strong>Accepted values</strong>
            <ul>
              <li><b>gender:</b> Male or Female</li>
              <li><b>maritalStatus:</b> Single, Married, Widowed, or Divorced</li>
              <li><b>membershipType:</b> Member, Visitor, or Consistent Visitor</li>
              <li><b>believerStatus:</b> Pre-believer, Believer, or New Believer; required for Visitor and Consistent Visitor, blank for Member</li>
              <li><b>role:</b> member, core_team, lg_leader, assistantlg_leader, unit_leader, assistantunit_leader, or subdistrict_leader</li>
              <li><b>restricted roles:</b> manager, admin, and master_admin cannot be bulk imported</li>
              <li><b>optional:</b> birthDate, maritalStatus, joinDate, memberSince, and phone numbers</li>
            </ul>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={selectFile} />
          {fileName && <p><strong>{fileName}</strong> — {members.length} data rows</p>}
        </section>
        {preview.length > 0 && <section className="bulk-import__section"><h3>2. Preview</h3>
          <div className="bulk-import__table-wrap"><table><thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Membership</th><th>Life group</th><th>Role</th></tr></thead>
            <tbody>{preview.map((member, index) => <tr key={`${member.email}-${index}`}><td>{index + 2}</td><td>{member.firstName} {member.lastName}</td><td>{member.email}</td><td>{member.membershipType || 'Member'}</td><td>{member.lifeGroupName || '—'}</td><td>{member.role || 'member'}</td></tr>)}</tbody></table></div>
          {members.length > preview.length && <p>Showing the first {preview.length} of {members.length} rows.</p>}
        </section>}
        {(message || errors.length > 0) && <div className={errors.length ? 'bulk-import__alert bulk-import__alert--error' : 'bulk-import__alert'}>
          {message && <p>{message}</p>}{errors.length > 0 && <ul>{errors.slice(0, 20).map((item, index) => <li key={`${item.row}-${index}`}>{item.row ? `CSV row ${item.row}: ` : ''}{item.message}</li>)}</ul>}
        </div>}
      </div>
      <div className="modal__footer"><button type="button" className="btn btn--ghost btn--md" onClick={onClose}>Close</button><button type="button" className="btn btn--primary btn--md" onClick={runImport} disabled={saving || !members.length || errors.length > 0}>{saving ? 'Working…' : `Import ${members.length || ''} Members`}</button></div>
    </div>
  </div>;
};

export default BulkImportModal;
