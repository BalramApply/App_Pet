import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, errMsg } from '../api/client.js';
import {
  useApi, useDebounced, PageHead, Spinner, ErrorBox, Table, Badge, Modal, Pager, Field, Tabs, label, fmtDateTime,
} from '../components/ui.jsx';

const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-');
const dateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function VaccinationModal({ record, onClose, onSaved }) {
  const isNew = !record;
  const [petQuery, setPetQuery] = useState('');
  const dq = useDebounced(petQuery);
  const pets = useApi(() => (isNew && dq.length >= 2 ? api.get('/admin/pets', { params: { q: dq, limit: 10 } }).then((r) => r.data.data.pets) : Promise.resolve([])), [dq, isNew]);
  const [form, setForm] = useState({
    petId: '', vaccineName: record?.vaccineName || '', doseNumber: record?.doseNumber || 1,
    administeredDate: dateInput(record?.administeredDate) || dateInput(new Date()),
    nextDueDate: dateInput(record?.nextDueDate), batchNumber: record?.batchNumber || '',
    certificateUrl: record?.certificateUrl || '', clinicOrHomeNotes: record?.clinicOrHomeNotes || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isNew) {
        if (!form.petId) throw new Error('Search and choose a pet first.');
        await api.post('/admin/vaccinations', { ...form, doseNumber: Number(form.doseNumber), nextDueDate: form.nextDueDate || null });
      } else {
        await api.put(`/admin/vaccinations/${record._id}`, {
          batchNumber: form.batchNumber, certificateUrl: form.certificateUrl, clinicOrHomeNotes: form.clinicOrHomeNotes,
          nextDueDate: form.nextDueDate || null,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response ? errMsg(err) : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? 'Add vaccination record' : `${record.vaccineName} - ${record.pet?.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        {isNew ? (
          <>
            <Field label="Find pet (type 2+ letters)"><input value={petQuery} onChange={(e) => setPetQuery(e.target.value)} /></Field>
            <Field label="Pet">
              <select value={form.petId} onChange={set('petId')}>
                <option value="">Select pet</option>
                {(pets.data || []).map((p) => <option key={p._id} value={p._id}>{p.name} ({p.breed}) - {p.user?.name}</option>)}
              </select>
            </Field>
            <Field label="Vaccine name"><input value={form.vaccineName} onChange={set('vaccineName')} required /></Field>
            <div className="inline" style={{ marginTop: 10 }}>
              <Field label="Dose #"><input type="number" min="1" value={form.doseNumber} onChange={set('doseNumber')} /></Field>
              <Field label="Given on"><input type="date" value={form.administeredDate} onChange={set('administeredDate')} /></Field>
            </div>
          </>
        ) : null}
        <Field label="Next booster due"><input type="date" value={form.nextDueDate} onChange={set('nextDueDate')} /></Field>
        <Field label="Batch number"><input value={form.batchNumber} onChange={set('batchNumber')} /></Field>
        <Field label="Certificate link (https://...)"><input value={form.certificateUrl} onChange={set('certificateUrl')} /></Field>
        <Field label="Notes"><textarea value={form.clinicOrHomeNotes} onChange={set('clinicOrHomeNotes')} /></Field>
        <div style={{ marginTop: 14 }}><button className="btn primary" type="submit" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}

function Vaccinations() {
  const [due, setDue] = useState('');
  const [noCert, setNoCert] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);

  useEffect(() => { setPage(1); }, [due, noCert, dq]);

  const { data, loading, error, reload } = useApi(
    () => api.get('/admin/vaccinations', {
      params: { due: due || undefined, missingCertificate: noCert || undefined, q: dq || undefined, page, limit: 20 },
    }).then((r) => r.data.data),
    [due, noCert, dq, page]
  );

  const overdue = (d) => d && new Date(d).getTime() < Date.now();
  const columns = [
    { key: 'p', title: 'Pet', render: (r) => <strong>{r.pet?.name || '-'}</strong> },
    { key: 'o', title: 'Owner', render: (r) => (r.customer ? `${r.customer.name} (${r.customer.phone})` : '-') },
    { key: 'v', title: 'Vaccine', render: (r) => `${r.vaccineName} (dose ${r.doseNumber})` },
    { key: 'a', title: 'Given', render: (r) => day(r.administeredDate) },
    { key: 'n', title: 'Next due', render: (r) => (overdue(r.nextDueDate) ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{day(r.nextDueDate)} (overdue)</span> : day(r.nextDueDate)) },
    { key: 'c', title: 'Certificate', render: (r) => (r.certificateUrl ? <a href={r.certificateUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>View</a> : <Badge value="pending" />) },
  ];

  return (
    <>
      <div className="filters">
        <input placeholder="Search vaccine name" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={due} onChange={(e) => setDue(e.target.value)}>
          <option value="">All records</option>
          <option value="overdue">Booster overdue</option>
          <option value="upcoming">Booster due in 30 days</option>
        </select>
        <label className="check"><input type="checkbox" checked={noCert} onChange={(e) => setNoCert(e.target.checked)} /> Missing certificate</label>
        <button className="btn primary" onClick={() => setEditing(null)}><Plus size={14} /> Add record</button>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <>
          <Table columns={columns} rows={data.records} empty="No vaccination records match." onRowClick={(r) => setEditing(r)} />
          <Pager pagination={data.pagination} onPage={setPage} />
        </>
      ) : null}
      {editing !== undefined ? <VaccinationModal record={editing} onClose={() => setEditing(undefined)} onSaved={reload} /> : null}
    </>
  );
}

function PetModal({ id, onClose }) {
  const { data, loading, error } = useApi(() => api.get(`/admin/pets/${id}`).then((r) => r.data.data), [id]);
  const p = data?.pet;
  return (
    <Modal title={p ? `${p.name} (${p.breed})` : 'Pet'} onClose={onClose} wide>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {p ? (
        <>
          <div className="two">
            <div className="card">
              <div className="kv"><span>Owner</span><strong>{p.user?.name} ({p.user?.phone})</strong></div>
              <div className="kv"><span>Species / gender</span><span>{p.species} / {p.gender}</span></div>
              <div className="kv"><span>Age</span><span>{p.age?.years}y {p.age?.months}m ({label(p.age?.lifeStage)})</span></div>
              <div className="kv"><span>Weight</span><span>{p.weightKg ? `${p.weightKg} kg` : '-'}</span></div>
              <div className="kv"><span>Neutered / spayed</span><span>{p.neuteredOrSpayed ? 'Yes' : 'No'}</span></div>
            </div>
            <div className="card">
              <div className="kv"><span>Bookings</span><strong>{data.counts.bookings}</strong></div>
              <div className="kv"><span>Completed sessions</span><strong>{data.counts.completedSessions}</strong></div>
              <div className="kv"><span>Training level</span><span>{p.behaviourSummary?.trainingLevel || '-'}</span></div>
              <div className="kv"><span>Latest behaviour score</span><span>{p.behaviourSummary?.latestBehaviorScore ?? '-'}</span></div>
              <div className="kv"><span>Active</span><span>{p.isActive ? 'Yes' : 'Removed'}</span></div>
            </div>
          </div>
          <p className="sub" style={{ marginTop: 12 }}>
            Allergies: {p.medicalHistory?.allergies?.join(', ') || 'none'} | Conditions: {p.medicalHistory?.conditions?.join(', ') || 'none'} | Vet: {p.medicalHistory?.vetClinicName || '-'}
          </p>
          <h3>Vaccinations</h3>
          <Table
            columns={[
              { key: 'v', title: 'Vaccine', render: (r) => `${r.vaccineName} (dose ${r.doseNumber})` },
              { key: 'a', title: 'Given', render: (r) => day(r.administeredDate) },
              { key: 'n', title: 'Next due', render: (r) => day(r.nextDueDate) },
            ]}
            rows={data.vaccinations}
            empty="No vaccinations recorded."
          />
        </>
      ) : null}
    </Modal>
  );
}

function Pets() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [species, setSpecies] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => { setPage(1); }, [dq, species]);

  const { data, loading, error } = useApi(
    () => api.get('/admin/pets', { params: { q: dq || undefined, species: species || undefined, active: 'all', page, limit: 20 } }).then((r) => r.data.data),
    [dq, species, page]
  );

  const columns = [
    { key: 'n', title: 'Pet', render: (p) => <strong>{p.name}</strong> },
    { key: 's', title: 'Species / breed', render: (p) => `${p.species} - ${p.breed}` },
    { key: 'o', title: 'Owner', render: (p) => (p.user ? `${p.user.name} (${p.user.phone})` : '-') },
    { key: 'a', title: 'Active', render: (p) => (p.isActive ? 'Yes' : 'Removed') },
    { key: 'c', title: 'Added', render: (p) => fmtDateTime(p.createdAt) },
  ];

  return (
    <>
      <div className="filters">
        <input placeholder="Search pet name or breed" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={species} onChange={(e) => setSpecies(e.target.value)}>
          <option value="">Dogs and cats</option>
          <option value="dog">Dogs</option>
          <option value="cat">Cats</option>
        </select>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <>
          <Table columns={columns} rows={data.pets} empty="No pets match." onRowClick={(p) => setSelectedId(p._id)} />
          <Pager pagination={data.pagination} onPage={setPage} />
        </>
      ) : null}
      {selectedId ? <PetModal id={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </>
  );
}

export default function Records() {
  const [tab, setTab] = useState('vaccinations');
  return (
    <>
      <PageHead title="Pets & vaccines" subtitle="Health records and booster reminders" />
      <Tabs tabs={[['vaccinations', 'Vaccinations'], ['pets', 'Pets']]} value={tab} onChange={setTab} />
      {tab === 'vaccinations' ? <Vaccinations /> : <Pets />}
    </>
  );
}