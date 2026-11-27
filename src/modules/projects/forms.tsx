"use client";

import { AdjuntosRegistro } from "@/modules/proyectos/Imagenes";
import { useState } from "react";
import { AmountInput, FormModal } from "@/components/ui/FormModal";
import { DatePicker } from "@/components/ui/DatePicker";
import { ChoiceGroup, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useData } from "@/lib/store/DataProvider";
import type { Priority, Project, ProjectStatus, Task, TaskStatus } from "@/types/db";
import { formatAmountInput, parseCOP } from "@/utils/money";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { PRIORITIES, PROJECT_COLORS, PROJECT_STATUSES, TASK_STATUSES } from "./constants";

type Errors = Record<string, string>;

export function ProjectForm({ open, onClose, record }: { open: boolean; onClose: () => void; record?: Project }) {
  const { insert, update } = useData();
  const [name, setName] = useState(record?.name ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [category, setCategory] = useState(record?.category ?? "");
  const [color, setColor] = useState(record?.color ?? PROJECT_COLORS[0]);
  const [priority, setPriority] = useState<Priority>(record?.priority ?? "media");
  const [start, setStart] = useState(record?.start_date ?? "");
  const [due, setDue] = useState(record?.due_date ?? "");
  const [budget, setBudget] = useState(record?.budget ? formatAmountInput(String(record.budget)) : "");
  const [status, setStatus] = useState<ProjectStatus>(record?.status ?? "en_proceso");
  const [errors, setErrors] = useState<Errors>({});

  const submit = async () => {
    const e: Errors = {};
    if (!name.trim()) e.name = "Ponle un nombre al proyecto.";
    if (start && due && due < start) e.due = "La entrega no puede ser antes del inicio.";
    const b = budget ? parseCOP(budget) : null;
    if (budget && (b === null || b < 0)) e.budget = "Valor no válido.";
    setErrors(e);
    if (Object.keys(e).length) return false;
    const data = {
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      color,
      priority,
      start_date: start || null,
      due_date: due || null,
      budget: b,
      status,
    };
    if (record) {
      await update("projects", record.id, data);
      return "Proyecto actualizado.";
    }
    await insert("projects", data);
    return "Proyecto creado.";
  };

  return (
    <FormModal open={open} onClose={onClose} title={record ? "Editar proyecto" : "Nuevo proyecto"} onSubmit={submit}>
      <Field label="Nombre" error={errors.name}>
        {(id) => <Input id={id} value={name} placeholder="Ej. Rediseño portafolio" onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="Descripción (opcional)">
        {(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoría">
          {(id) => <Input id={id} value={category} placeholder="Ej. Diseño, Personal" onChange={(e) => setCategory(e.target.value)} />}
        </Field>
        <Field label="Estado">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fecha de inicio">
          {(id) => <DatePicker id={id} value={start} onChange={(e) => setStart(e.target.value)} />}
        </Field>
        <Field label="Fecha de entrega" error={errors.due}>
          {(id) => <DatePicker id={id} value={due} onChange={(e) => setDue(e.target.value)} />}
        </Field>
        <Field label="Presupuesto estimado" error={errors.budget}>
          {(id) => <AmountInput id={id} value={budget} onChange={setBudget} />}
        </Field>
        <Field label="Color" className="sm:col-span-2">
          {() => <ColorPicker value={color} onChange={setColor} />}
        </Field>
      </div>
      <Field label="Prioridad">{() => <ChoiceGroup value={priority} onChange={setPriority} options={PRIORITIES} />}</Field>
    </FormModal>
  );
}

export function TaskForm({
  open,
  onClose,
  record,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  record?: Task;
  defaults?: Partial<Task>;
}) {
  const { db, insert, update } = useData();
  const init = { ...defaults, ...record };
  const [name, setName] = useState(init.name ?? "");
  const [description, setDescription] = useState(init.description ?? "");
  const [projectId, setProjectId] = useState(init.project_id ?? "");
  const [due, setDue] = useState(init.due_date ?? "");
  const [priority, setPriority] = useState<Priority>(init.priority ?? "media");
  const [status, setStatus] = useState<TaskStatus>(init.status ?? "pendiente");
  const [errors, setErrors] = useState<Errors>({});
  const parent = init.parent_task_id ? db.tasks.find((t) => t.id === init.parent_task_id) : null;

  const submit = async () => {
    const e: Errors = {};
    if (!name.trim()) e.name = "Escribe el nombre de la tarea.";
    setErrors(e);
    if (Object.keys(e).length) return false;
    const data = {
      name: name.trim(),
      description: description.trim() || null,
      project_id: projectId || null,
      parent_task_id: init.parent_task_id ?? null,
      due_date: due || null,
      priority,
      status,
    };
    if (record) {
      await update("tasks", record.id, data);
      // Si la tarea cambió de proyecto, sus subtareas se van con ella (si no, seguirían sumando al proyecto anterior)
      if ((record.project_id ?? null) !== data.project_id) {
        const hijas = db.tasks.filter((t) => t.parent_task_id === record.id);
        await Promise.all(hijas.map((t) => update("tasks", t.id, { project_id: data.project_id })));
      }
      return "Tarea actualizada.";
    }
    await insert("tasks", data);
    return parent ? "Subtarea creada." : "Tarea creada.";
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={record ? "Editar tarea" : parent ? "Nueva subtarea" : "Nueva tarea"}
      description={parent ? `Dentro de: ${parent.name}` : undefined}
      onSubmit={submit}
    >
      <Field label="Nombre" error={errors.name}>
        {(id) => <Input id={id} value={name} placeholder="Ej. Enviar propuesta" onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Proyecto relacionado">
          {(id) => (
            <Select id={id} value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!!parent}>
              <option value="">Sin proyecto</option>
              {db.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fecha límite">
          {(id) => <DatePicker id={id} value={due} onChange={(e) => setDue(e.target.value)} />}
        </Field>
        <Field label="Estado">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Prioridad">{() => <ChoiceGroup value={priority} onChange={setPriority} options={PRIORITIES} />}</Field>
      </div>
      <Field label="Descripción (opcional)">
        {(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      {record ? <AdjuntosRegistro tabla="tasks" id={record.id} /> : null}
    </FormModal>
  );
}
