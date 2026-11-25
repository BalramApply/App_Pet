import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, errMsg } from '../api/client.js';
import {
  useApi, PageHead, Spinner, ErrorBox, Table, Badge, Modal, Field, Tabs, label, inr, toLines, fromLines,
} from '../components/ui.jsx';

const SPECIES = ['dog', 'cat'];

function SpeciesPicker({ value, options, onChange }) {
  const toggle = (s) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  return (
    <div className="inline" style={{ marginTop: 6 }}>
      {options.map((s) => (
        <label className="check" key={s}><input type="checkbox" checked={value.includes(s)} onChange={() => toggle(s)} /> {s}</label>
      ))}
    </div>
  );
}

function useSubmit(onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onDone();
    } catch (err) {
      setError(err.response ? errMsg(err) : err.message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function ServiceModal({ service, onClose, onSaved }) {
  const isNew = !service;
  const [f, setF] = useState({
    type: service?.type || 'Training', code: service?.code || '', title: service?.title || '', description: service?.description || '',
    targetSpecies: service?.targetSpecies || ['dog'], sessionDuration: service?.sessionDuration || 45,
    syllabus: fromLines(service?.syllabusOrInclusions), features: fromLines(service?.features), activeStatus: service ? service.activeStatus : true,
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const { busy, error, submit } = useSubmit(() => { onSaved(); onClose(); });

  const save = (e) => {
    e.preventDefault();
    submit(() => {
      const body = {
        title: f.title, description: f.description, targetSpecies: f.targetSpecies, sessionDuration: Number(f.sessionDuration),
        syllabusOrInclusions: toLines(f.syllabus), features: toLines(f.features), activeStatus: f.activeStatus,
      };
      return isNew ? api.post('/admin/catalog/services', { ...body, type: f.type, code: f.code }) : api.put(`/admin/catalog/services/${service._id}`, body);
    });
  };

  return (
    <Modal title={isNew ? 'Add service' : service.title} onClose={onClose}>
      <form onSubmit={save}>
        <ErrorBox message={error} />
        {isNew ? (
          <div className="inline">
            <Field label="Type">
              <select value={f.type} onChange={set('type')}>{['Training', 'Walking', 'Grooming', 'Vaccination'].map((t) => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Code (e.g. TRN_ADV)"><input value={f.code} onChange={set('code')} /></Field>
          </div>
        ) : <p className="sub">{service.type} - {service.code} (type and code cannot be changed)</p>}
        <Field label="Title"><input value={f.title} onChange={set('title')} required /></Field>
        <Field label="Description"><textarea value={f.description} onChange={set('description')} /></Field>
        <Field label="Species"><SpeciesPicker value={f.targetSpecies} options={SPECIES} onChange={(v) => setF((x) => ({ ...x, targetSpecies: v }))} /></Field>
        <Field label="Standard session length (minutes)"><input type="number" value={f.sessionDuration} onChange={set('sessionDuration')} /></Field>
        <Field label="Syllabus / inclusions (one per line)"><textarea value={f.syllabus} onChange={set('syllabus')} /></Field>
        <Field label="Feature tags (one per line)"><textarea value={f.features} onChange={set('features')} /></Field>
        <label className="check"><input type="checkbox" checked={f.activeStatus} onChange={(e) => setF((x) => ({ ...x, activeStatus: e.target.checked }))} /> Visible in the app</label>
        <button className="btn primary" type="submit" disabled={busy}>Save</button>
      </form>
    </Modal>
  );
}

function PackageModal({ pkg, services, onClose, onSaved }) {
  const isNew = !pkg;
  const [serviceId, setServiceId] = useState(pkg ? (pkg.service?._id || pkg.service) : '');
  const service = services.find((s) => s._id === serviceId);
  const [f, setF] = useState({
    name: pkg?.name || '', categoryTag: pkg?.categoryTag || 'General', species: pkg?.species || ['dog'], lifeStage: pkg?.lifeStage || 'all',
    sessionCount: pkg?.sessionCount || 1, sessionDuration: pkg?.sessionDuration || '', price: pkg?.price ?? '',
    payout: pkg?.trainerPayoutPerSession ?? '', freeDemo: pkg?.freeDemoEligible || false, inclusions: fromLines(pkg?.inclusions),
    vaccineName: pkg?.vaccineDetails?.vaccineName || '', doseCount: pkg?.vaccineDetails?.doseCount || 1,
    booster: pkg?.vaccineDetails?.boosterIntervalDays || 365, activeStatus: pkg ? pkg.activeStatus : true,
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const { busy, error, submit } = useSubmit(() => { onSaved(); onClose(); });

  const save = (e) => {
    e.preventDefault();
    submit(async () => {
      if (!service) throw new Error('Choose a service.');
      const body = {
        name: f.name, categoryTag: f.categoryTag, species: f.species, lifeStage: f.lifeStage, sessionCount: Number(f.sessionCount),
        price: Number(f.price), freeDemoEligible: f.freeDemo, inclusions: toLines(f.inclusions), activeStatus: f.activeStatus,
      };
      if (f.sessionDuration !== '') body.sessionDuration = Number(f.sessionDuration);
      if (f.payout !== '') body.trainerPayoutPerSession = Number(f.payout);
      if (service.type === 'Vaccination') body.vaccineDetails = { vaccineName: f.vaccineName, doseCount: Number(f.doseCount), boosterIntervalDays: Number(f.booster) };
      const res = isNew ? await api.post('/admin/catalog/packages', { ...body, service: serviceId }) : await api.put(`/admin/catalog/packages/${pkg._id}`, body);
      if (res.data.message && !isNew) window.alert(res.data.message);
    });
  };

  return (
    <Modal title={isNew ? 'Add package' : pkg.name} onClose={onClose} wide>
      <form onSubmit={save}>
        <ErrorBox message={error} />
        <Field label="Service">
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={!isNew}>
            <option value="">Select service</option>
            {services.map((s) => <option key={s._id} value={s._id}>{s.type} - {s.title}</option>)}
          </select>
        </Field>
        <div className="two">
          <div>
            <Field label="Package name"><input value={f.name} onChange={set('name')} required /></Field>
            <Field label="Category tag"><input value={f.categoryTag} onChange={set('categoryTag')} /></Field>
            <Field label="Species"><SpeciesPicker value={f.species} options={service?.targetSpecies || SPECIES} onChange={(v) => setF((x) => ({ ...x, species: v }))} /></Field>
            <Field label="Life stage">
              <select value={f.lifeStage} onChange={set('lifeStage')}>{['all', 'puppy_kitten', 'adult', 'senior'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
            </Field>
          </div>
          <div>
            <div className="inline">
              <Field label="Sessions"><input type="number" min="1" value={f.sessionCount} onChange={set('sessionCount')} /></Field>
              <Field label="Minutes each (blank = service default)"><input type="number" value={f.sessionDuration} onChange={set('sessionDuration')} /></Field>
            </div>
            <div className="inline" style={{ marginTop: 10 }}>
              <Field label="Package price (INR)"><input type="number" min="0" value={f.price} onChange={set('price')} /></Field>
              <Field label="Payout per session (blank = default %)"><input type="number" min="0" value={f.payout} onChange={set('payout')} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={f.freeDemo} onChange={(e) => setF((x) => ({ ...x, freeDemo: e.target.checked }))} /> Free assessment / demo (price 0, 1 session)</label>
            <label className="check"><input type="checkbox" checked={f.activeStatus} onChange={(e) => setF((x) => ({ ...x, activeStatus: e.target.checked }))} /> Visible in the app</label>
          </div>
        </div>
        {service?.type === 'Vaccination' ? (
          <div className="inline">
            <Field label="Vaccine name"><input value={f.vaccineName} onChange={set('vaccineName')} /></Field>
            <Field label="Doses"><input type="number" min="1" value={f.doseCount} onChange={set('doseCount')} /></Field>
            <Field label="Booster after (days)"><input type="number" min="1" value={f.booster} onChange={set('booster')} /></Field>
          </div>
        ) : null}
        <Field label="Inclusions (one per line)"><textarea value={f.inclusions} onChange={set('inclusions')} /></Field>
        <div style={{ marginTop: 14 }}><button className="btn primary" type="submit" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}

export default function Catalog() {
  const [tab, setTab] = useState('packages');
  const [serviceFilter, setServiceFilter] = useState('');
  const [editService, setEditService] = useState(undefined);
  const [editPackage, setEditPackage] = useState(undefined);

  const services = useApi(() => api.get('/admin/catalog/services').then((r) => r.data.data.services), []);
  const packages = useApi(
    () => api.get('/admin/catalog/packages', { params: { serviceId: serviceFilter || undefined } }).then((r) => r.data.data.packages),
    [serviceFilter]
  );

  const active = (a) => <Badge value={a ? 'active' : 'hidden'} />;

  return (
    <>
      <PageHead title="Catalog" subtitle="Services and packages shown in the mobile app. Items are hidden, never deleted.">
        {tab === 'packages'
          ? <button className="btn primary" onClick={() => setEditPackage(null)}><Plus size={14} /> Add package</button>
          : <button className="btn primary" onClick={() => setEditService(null)}><Plus size={14} /> Add service</button>}
      </PageHead>
      <Tabs tabs={[['packages', 'Packages'], ['services', 'Services']]} value={tab} onChange={setTab} />
      <ErrorBox message={services.error || packages.error} />

      {tab === 'packages' ? (
        <>
          <div className="filters">
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
              <option value="">All services</option>
              {(services.data || []).map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}
            </select>
          </div>
          {packages.loading && !packages.data ? <Spinner /> : (
            <Table
              columns={[
                { key: 'n', title: 'Package', render: (p) => <strong>{p.name}</strong> },
                { key: 's', title: 'Service', render: (p) => p.service?.title || '-' },
                { key: 'sp', title: 'Species', render: (p) => p.species.join(', ') },
                { key: 'se', title: 'Sessions', render: (p) => `${p.sessionCount} x ${p.sessionDuration} min` },
                { key: 'pr', title: 'Price', render: (p) => (p.price === 0 ? 'FREE' : inr(p.price)) },
                { key: 'po', title: 'Payout / session', render: (p) => inr(p.trainerPayoutPerSession) },
                { key: 'a', title: 'App', render: (p) => active(p.activeStatus) },
              ]}
              rows={packages.data}
              empty="No packages yet."
              onRowClick={(p) => setEditPackage(p)}
            />
          )}
        </>
      ) : (
        services.loading && !services.data ? <Spinner /> : (
          <Table
            columns={[
              { key: 'n', title: 'Service', render: (s) => <strong>{s.title}</strong> },
              { key: 't', title: 'Type', render: (s) => s.type },
              { key: 'c', title: 'Code', render: (s) => s.code },
              { key: 'sp', title: 'Species', render: (s) => s.targetSpecies.join(', ') },
              { key: 'd', title: 'Minutes', render: (s) => s.sessionDuration },
              { key: 'p', title: 'Packages', render: (s) => `${s.packageCounts.active} active / ${s.packageCounts.total}` },
              { key: 'a', title: 'App', render: (s) => active(s.activeStatus) },
            ]}
            rows={services.data}
            empty="No services yet."
            onRowClick={(s) => setEditService(s)}
          />
        )
      )}

      {editService !== undefined ? <ServiceModal service={editService} onClose={() => setEditService(undefined)} onSaved={() => { services.reload(); packages.reload(); }} /> : null}
      {editPackage !== undefined ? <PackageModal pkg={editPackage} services={services.data || []} onClose={() => setEditPackage(undefined)} onSaved={packages.reload} /> : null}
    </>
  );
}