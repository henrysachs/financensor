# API Keys

API-Keys sind gruppengebunden und handeln als ausgewaehltes Mitglied der Gruppe.

Format:

```text
Authorization: Bearer fin-token_...
```

## Erstellen

Im Frontend unter `Mitglieder -> API-Keys`:

- Label vergeben
- `Handelt als` waehlen
- Token einmal kopieren

Der Token wird nur beim Erstellen angezeigt. Im Backend wird nur ein Hash gespeichert.

## Erlaubte Endpunkte

Aktuell mit API-Key erlaubt:

- `GET /api/v1/users/me`
- `GET /api/v1/groups/{groupId}`
- `GET /api/v1/groups/{groupId}/members`
- `GET/POST /api/v1/groups/{groupId}/purchases`
- `POST /api/v1/groups/{groupId}/purchases/bulk`
- `PUT/DELETE /api/v1/groups/{groupId}/purchases/{purchaseId}`
- `POST /api/v1/groups/{groupId}/purchases/{purchaseId}/receipt`
- `GET/POST /api/v1/groups/{groupId}/categories`
- `GET/POST /api/v1/groups/{groupId}/trips`
- `GET/PUT /api/v1/groups/{groupId}/trips/{tripId}`
- `GET /api/v1/groups/{groupId}/settlements`

Nicht erlaubt:

- Gruppen loeschen/aendern
- Mitglieder aendern
- API-Keys verwalten
- Einladungen verwalten

## Beispiele

```bash
curl -H "Authorization: Bearer fin-token_..." \
  https://api.financensor.stammkneipe.dev/api/v1/groups/<group-id>/purchases
```

```bash
curl -X POST \
  -H "Authorization: Bearer fin-token_..." \
  -H "Content-Type: application/json" \
  https://api.financensor.stammkneipe.dev/api/v1/groups/<group-id>/categories \
  -d '{"name":"Essen"}'
```

```bash
curl -X POST \
  -H "Authorization: Bearer fin-token_..." \
  -H "Content-Type: application/json" \
  https://api.financensor.stammkneipe.dev/api/v1/groups/<group-id>/purchases/bulk \
  -d '[
    {
      "description": "REWE",
      "amountCents": 1299,
      "paidByUserId": "<acting-as-user-id>",
      "categoryId": "<category-id>",
      "assignedTo": ["<user-id-1>", "<user-id-2>"]
    }
  ]'
```
