import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Section } from '../../components/Section'
import { archiveTask, createTask } from '../../data/api'
import type { Family, Task } from '../../data/types'
import { errorMessage, formatMoney } from '../../lib/format'

const TASK_EMOJIS = [
  '✨', '🧹', '🧽', '🧺', '🛏️', '🍽️',
  '🗑️', '📚', '🐕', '🌱', '🚿', '🚲',
  '🧸', '🧼', '🍳', '🥣', '🧤', '🪣',
  '🛒', '🧑‍🍳',
]

export function TaskSection({ family, tasks, refresh, onNotice }: {
  family: Family
  tasks: Task[]
  refresh: () => void
  onNotice: (value: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('15')
  const [emoji, setEmoji] = useState('✨')

  const addTask = async (event: FormEvent) => {
    event.preventDefault()
    const amountOre = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!Number.isFinite(amountOre) || amountOre < 0) {
      onNotice('Skriv inn et gyldig beløp.')
      return
    }

    try {
      await createTask({
        familyId: family.id,
        title: title.trim(),
        description: description.trim(),
        amountOre,
        emoji,
      })
      setTitle('')
      setDescription('')
      setAmount('15')
      onNotice('Oppgaven er lagt til.')
      refresh()
    } catch (error) {
      onNotice(errorMessage(error))
    }
  }

  const archive = async (task: Task) => {
    try {
      await archiveTask(task.id)
      onNotice('Oppgaven er arkivert.')
      refresh()
    } catch (error) {
      onNotice(errorMessage(error))
    }
  }

  return (
    <Section title="Oppgaver" eyebrow="Administrer">
      <form className="compact-form" onSubmit={addTask}>
        <div className="form-row">
          <select value={emoji} onChange={(event) => setEmoji(event.target.value)}>
            {TASK_EMOJIS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input
            required
            placeholder="Navn på oppgaven"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <input
            className="amount-input"
            required
            inputMode="decimal"
            aria-label="Beløp i kroner"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <input
          placeholder="Kort beskrivelse"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <button className="primary-button"><Plus size={17} /> Legg til oppgave</button>
      </form>
      <div className="mini-list">
        {tasks.filter((task) => task.active).map((task) => (
          <div key={task.id}>
            <span>{task.emoji}</span>
            <div>
              <strong>{task.title}</strong>
              <small>{formatMoney(task.amount_ore)}</small>
            </div>
            <button
              className="icon-button danger"
              onClick={() => void archive(task)}
              aria-label={`Arkiver ${task.title}`}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
    </Section>
  )
}
