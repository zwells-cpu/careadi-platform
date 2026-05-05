export function replaceRecordById(records, nextRecord, getId) {
  const nextId = getId(nextRecord)
  if (nextId === null || nextId === undefined || nextId === '') return records

  let found = false
  const updated = records.map(record => {
    if (getId(record) === nextId) {
      found = true
      return { ...record, ...nextRecord }
    }
    return record
  })

  return found ? updated : [nextRecord, ...records]
}

export function removeRecordById(records, id, getId) {
  return records.filter(record => getId(record) !== id)
}
