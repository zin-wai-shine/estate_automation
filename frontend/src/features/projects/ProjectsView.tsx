import React, { useState } from 'react';
import type { Project } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { FiPlus, FiFolder, FiImage, FiSearch } from 'react-icons/fi';

export const ProjectsView: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([
    {
      id: 1,
      name: 'Ashton Asoke',
      code: 'ASHTON-ASOKE',
      district: 'Watthana',
      province: 'Bangkok',
      bts: 'Asoke',
      mrt: 'Sukhumvit',
      defaultImageCount: 2,
      status: 'ACTIVE',
      assets: ['asset_1.jpg', 'asset_2.jpg', 'asset_3.jpg'],
    },
    {
      id: 2,
      name: 'Ideo Sukhumvit 93',
      code: 'IDEO-S93',
      district: 'Phra Khanong',
      province: 'Bangkok',
      bts: 'Bang Chak',
      defaultImageCount: 2,
      status: 'ACTIVE',
      assets: ['asset_1.jpg', 'asset_2.jpg'],
    },
    {
      id: 3,
      name: 'Rhythm Ekamai',
      code: 'RHYTHM-EKA',
      district: 'Watthana',
      province: 'Bangkok',
      bts: 'Ekamai',
      defaultImageCount: 2,
      status: 'ACTIVE',
      assets: ['asset_1.jpg'],
    },
  ]);

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [district, setDistrict] = useState('');
  const [bts, setBts] = useState('');
  const [imageCount, setImageCount] = useState(2);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newProject: Project = {
      id: Date.now(),
      name,
      code: code || name.toUpperCase().replace(/\s+/g, '-'),
      district: district || 'Bangkok',
      province: 'Bangkok',
      bts,
      defaultImageCount: Number(imageCount),
      status: 'ACTIVE',
      assets: ['asset_1.jpg', 'asset_2.jpg'],
    };

    setProjects([newProject, ...projects]);
    setIsModalOpen(false);
    setName('');
    setCode('');
    setDistrict('');
    setBts('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Action Header */}
      <div
        style={{
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <Input
            placeholder="Search projects / condos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<FiSearch />}
          />
        </div>

        <Button variant="primary" leftIcon={<FiPlus />} onClick={() => setIsModalOpen(true)}>
          Add New Project / Condo
        </Button>
      </div>

      {/* Projects Grid Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            style={{
              padding: '1.25rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}><FiFolder /></span>
                  <div>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{project.name}</h3>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>CODE: {project.code}</span>
                  </div>
                </div>
                <Badge variant={project.status === 'ACTIVE' ? 'success' : 'outline'}>{project.status}</Badge>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.75rem' }}>
                <p>Location: <strong>{project.district}, {project.province}</strong></p>
                {project.bts && <p>Nearest BTS: <strong>{project.bts}</strong></p>}
                {project.mrt && <p>Nearest MRT: <strong>{project.mrt}</strong></p>}
                <p>Default Project Images Used Before Property Images: <strong style={{ color: 'var(--accent-primary)' }}>{project.defaultImageCount} images</strong></p>
              </div>
            </div>

            {/* Reusable Project Assets Preview */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.375rem' }}>
                Project Reusable Assets ({project.assets.length})
              </span>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {project.assets.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '0.25rem',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.625rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <FiImage /> {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Project Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Condo / Building Project">
        <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <Input label="Project / Condo Name" placeholder="e.g. Ashton Asoke" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Project Code" placeholder="ASHTON-ASOKE" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input label="District" placeholder="Watthana" value={district} onChange={(e) => setDistrict(e.target.value)} />
          <Input label="Nearest BTS Station" placeholder="Asoke" value={bts} onChange={(e) => setBts(e.target.value)} />
          <Input label="Default Project Images Used Before Property Images" type="number" value={imageCount} onChange={(e) => setImageCount(Number(e.target.value))} />

          <Button type="submit" variant="primary" style={{ marginTop: '0.5rem' }}>
            Create Project
          </Button>
        </form>
      </Modal>
    </div>
  );
};
