import { useEffect, useRef, useState } from 'react'
import { request, useApiData } from '../clientApi.js'
import { RequestState } from '../components/Hotel.jsx'
import { money, plural } from '../stay.js'

const paths = { room: '/rooms', type: '/room-types' }
const kindLabels = { room: 'room', type: 'room type' }
const itemName = (kind, item) => (kind === 'room' ? `Room ${item.room_number}` : item.name)

// One <dialog> serves every form and confirmation, opened while `open` is true.
function Modal({ open, title, busy, onClose, children }) {
  const dialog = useRef(null)
  useEffect(() => {
    const node = dialog.current
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])
  return (
    <dialog ref={dialog} className="panel confirm wide" aria-labelledby="admin-dialog-title" onCancel={(event) => {
      event.preventDefault()
      if (!busy) onClose()
    }}>
      {open && <><h2 id="admin-dialog-title">{title}</h2>{children}</>}
    </dialog>
  )
}

// Shows the server's validation message for one field, if there is one.
function FieldError({ failure, field }) {
  const detail = failure?.details?.find((item) => item.field === field)
  return detail ? <span className="error field-error">{detail.message}</span> : null
}

function FormActions({ busy, onClose }) {
  return (
    <div className="dialog-actions">
      <button type="button" className="button outline" disabled={busy} onClick={onClose}>Cancel</button>
      <button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
    </div>
  )
}

function RoomTypeForm({ item, busy, failure, onSave, onClose }) {
  return (
    <form className="admin-form" onSubmit={(event) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      onSave({
        name: form.get('name').trim(),
        description: form.get('description').trim() || null,
        capacity: Number(form.get('capacity')),
        price_per_night: Number(form.get('price_per_night')),
      })
    }}>
      <label>Name<input name="name" defaultValue={item?.name} maxLength={80} required /><FieldError failure={failure} field="name" /></label>
      <label>Description<textarea name="description" defaultValue={item?.description ?? ''} maxLength={1000} rows={3} /><FieldError failure={failure} field="description" /></label>
      <div className="form-pair">
        <label>Guests<input name="capacity" type="number" min="1" max="20" defaultValue={item?.capacity ?? 2} required /><FieldError failure={failure} field="capacity" /></label>
        <label>Price per night (GEL)<input name="price_per_night" type="number" min="0.01" max="99999999.99" step="0.01" defaultValue={item?.price_per_night} required /><FieldError failure={failure} field="price_per_night" /></label>
      </div>
      {failure && !failure.details && <p className="error" role="alert">{failure.message}</p>}
      <FormActions busy={busy} onClose={onClose} />
    </form>
  )
}

function RoomForm({ item, types, busy, failure, onSave, onClose }) {
  return (
    <form className="admin-form" onSubmit={(event) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      onSave({
        room_number: form.get('room_number').trim(),
        floor: Number(form.get('floor')),
        room_type_id: Number(form.get('room_type_id')),
        is_active: form.get('is_active') === 'on',
      })
    }}>
      <div className="form-pair">
        <label>Room number<input name="room_number" defaultValue={item?.room_number} maxLength={10} required /><FieldError failure={failure} field="room_number" /></label>
        <label>Floor<input name="floor" type="number" min="-5" max="100" defaultValue={item?.floor ?? 1} required /><FieldError failure={failure} field="floor" /></label>
      </div>
      <label>Room type<select name="room_type_id" defaultValue={item?.room_type_id ?? ''} required>
        <option value="" disabled>Choose a room type</option>
        {types.map((type) => <option key={type.id} value={type.id}>{type.name} · up to {plural(type.capacity, 'guest')} · {money(type.price_per_night)}</option>)}
      </select><FieldError failure={failure} field="room_type_id" /></label>
      <label className="check"><input name="is_active" type="checkbox" defaultChecked={item?.is_active ?? true} />Open for booking</label>
      {failure && !failure.details && <p className="error" role="alert">{failure.message}</p>}
      <FormActions busy={busy} onClose={onClose} />
    </form>
  )
}

function DeleteConfirm({ kind, item, busy, failure, onDelete, onClose }) {
  return (
    <>
      <p>{kind === 'room'
        ? 'The room will be removed for good. A room with reservations cannot be deleted, so close it for booking instead.'
        : 'The room type will be removed for good. Rooms that use it must be moved or deleted first.'}</p>
      {failure && <p className="error" role="alert">{failure.message}</p>}
      <div className="dialog-actions">
        <button className="button outline" autoFocus disabled={busy} onClick={onClose}>Keep {kindLabels[kind]}</button>
        <button className="button danger" disabled={busy} onClick={onDelete}>{busy ? 'Deleting…' : `Delete ${itemName(kind, item)}`}</button>
      </div>
    </>
  )
}

export function Admin() {
  const types = useApiData('/room-types')
  const rooms = useApiData('/rooms')
  // { action: 'save' | 'delete', kind: 'room' | 'type', item } while a dialog is open.
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const [message, setMessage] = useState('')

  const open = (next) => {
    setFailure(null)
    setDialog(next)
  }
  const close = () => setDialog(null)

  async function run(action, success) {
    setBusy(true)
    setFailure(null)
    try {
      await action()
      setDialog(null)
      setMessage(success)
      types.reload()
      rooms.reload()
    } catch (error) {
      setFailure(error)
    } finally {
      setBusy(false)
    }
  }

  function save(body) {
    const { kind, item } = dialog
    const path = item ? `${paths[kind]}/${item.id}` : paths[kind]
    run(() => request(path, { method: item ? 'PUT' : 'POST', body }), `${itemName(kind, body)} ${item ? 'updated' : 'added'}.`)
  }

  function remove() {
    const { kind, item } = dialog
    run(() => request(`${paths[kind]}/${item.id}`, { method: 'DELETE' }), `${itemName(kind, item)} deleted.`)
  }

  const roomCount = (typeId) => rooms.data?.filter((room) => room.room_type_id === typeId).length ?? 0
  const formProps = { item: dialog?.item, busy, failure, onClose: close }
  const title = dialog && (dialog.action === 'delete'
    ? `Delete ${itemName(dialog.kind, dialog.item)}?`
    : `${dialog.item ? 'Edit' : 'Add'} ${kindLabels[dialog.kind]}`)

  return (
    <section className="shell page">
      <header className="page-heading"><h1>Manage rooms</h1><p>Room types set the price and guest limit. Each room belongs to one type.</p></header>
      {message && <p className="notice positive" role="status">{message}</p>}

      <section className="admin-section" aria-labelledby="types-heading">
        <div className="table-heading">
          <h2 id="types-heading">Room types</h2>
          <button className="button primary compact" onClick={() => open({ action: 'save', kind: 'type' })}>Add room type</button>
        </div>
        <RequestState result={types} label="Loading room types…" />
        {types.data?.length === 0 && <p className="notice">No room types yet. Add one before adding rooms.</p>}
        {types.data?.length > 0 && (
          <div className="panel table-scroll" tabIndex="0" aria-label="Room types table">
            <table>
              <thead><tr><th scope="col">Name</th><th scope="col">Guests</th><th scope="col">Price per night</th><th scope="col">Rooms</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>{types.data.map((type) => (
                <tr key={type.id}>
                  <th scope="row">{type.name}{type.description && <span className="muted">{type.description}</span>}</th>
                  <td>Up to {type.capacity}</td>
                  <td>{money(type.price_per_night)}</td>
                  <td>{rooms.data ? roomCount(type.id) : '—'}</td>
                  <td><div className="row-actions">
                    <button className="button outline compact" aria-label={`Edit ${type.name}`} onClick={() => open({ action: 'save', kind: 'type', item: type })}>Edit</button>
                    <button className="button remove compact" aria-label={`Delete ${type.name}`} onClick={() => open({ action: 'delete', kind: 'type', item: type })}>Delete</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section" aria-labelledby="rooms-heading">
        <div className="table-heading">
          <h2 id="rooms-heading">Rooms</h2>
          <button className="button primary compact" disabled={!types.data?.length} onClick={() => open({ action: 'save', kind: 'room' })}>Add room</button>
        </div>
        <RequestState result={rooms} label="Loading rooms…" />
        {rooms.data?.length === 0 && <p className="notice">No rooms yet.</p>}
        {rooms.data?.length > 0 && (
          <div className="panel table-scroll" tabIndex="0" aria-label="Rooms table">
            <table>
              <thead><tr><th scope="col">Room</th><th scope="col">Floor</th><th scope="col">Type</th><th scope="col">Booking</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>{rooms.data.map((room) => (
                <tr key={room.id}>
                  <th scope="row">{room.room_number}</th>
                  <td>{room.floor}</td>
                  <td>{room.room_type_name}<span className="muted">Up to {plural(room.capacity, 'guest')} · {money(room.price_per_night)}</span></td>
                  <td><span className={room.is_active ? 'status status-active' : 'status'}>{room.is_active ? 'Open' : 'Closed'}</span></td>
                  <td><div className="row-actions">
                    <button className="button outline compact" aria-label={`Edit room ${room.room_number}`} onClick={() => open({ action: 'save', kind: 'room', item: room })}>Edit</button>
                    <button className="button remove compact" aria-label={`Delete room ${room.room_number}`} onClick={() => open({ action: 'delete', kind: 'room', item: room })}>Delete</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={Boolean(dialog)} title={title} busy={busy} onClose={close}>
        {dialog?.action === 'delete' && <DeleteConfirm kind={dialog.kind} {...formProps} onDelete={remove} />}
        {dialog?.action === 'save' && dialog.kind === 'type' && <RoomTypeForm {...formProps} onSave={save} />}
        {dialog?.action === 'save' && dialog.kind === 'room' && <RoomForm {...formProps} types={types.data ?? []} onSave={save} />}
      </Modal>
    </section>
  )
}
