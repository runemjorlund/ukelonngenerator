import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Section } from '../../components/Section'
import { updateNotificationSchedule } from '../../data/api'
import type { Family } from '../../data/types'
import { errorMessage } from '../../lib/format'
import { subscribeToPush } from '../../lib/push'
import './PushSettings.css'

const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']

export function PushSettings({ family, refresh, onNotice }: {
  family: Family
  refresh: () => void
  onNotice: (value: string) => void
}) {
  const [pushBusy, setPushBusy] = useState(false)

  const updateSchedule = async (weekday: number, time: string) => {
    try {
      await updateNotificationSchedule(family.id, weekday, time)
      onNotice('Varseltidspunktet er lagret.')
      refresh()
    } catch (error) {
      onNotice(errorMessage(error))
    }
  }

  const enablePush = async () => {
    setPushBusy(true)
    try {
      await subscribeToPush()
      onNotice('Pushvarsler er aktivert og et testvarsel er sendt.')
    } catch (error) {
      onNotice(errorMessage(error))
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <Section title="Ukentlig pushvarsel" eyebrow="Påminnelse til de voksne">
      <div className="notification-settings push-notification-settings">
        <label>
          Dag
          <select
            value={family.notification_weekday}
            onChange={(event) => void updateSchedule(
              Number(event.target.value),
              family.notification_time,
            )}
          >
            {WEEKDAYS.map((day, index) => (
              <option value={index} key={day}>{day}</option>
            ))}
          </select>
        </label>
        <label>
          Klokkeslett
          <input
            type="time"
            value={family.notification_time.slice(0, 5)}
            onChange={(event) => void updateSchedule(
              family.notification_weekday,
              event.target.value,
            )}
          />
        </label>
        <button
          className="primary-button"
          onClick={() => void enablePush()}
          disabled={pushBusy}
        >
          <Bell size={17} />
          {pushBusy ? 'Aktiverer…' : 'Aktiver varsler på denne enheten'}
        </button>
      </div>
      <p className="help-text">
        På iPhone og iPad må appen først legges til på Hjem-skjermen.
        Varseltillatelsen gis alltid av personen som bruker enheten.
      </p>
    </Section>
  )
}
