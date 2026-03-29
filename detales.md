# Local System Details

## Login Notes

- Admin and voter login use `NID + DOB`
- No password is required for these local demo accounts

## Admin Details

- Email: `admin@example.com`
- NID: `0000900001`
- DOB: `1990-01-01`
- Role: `ADMIN`

## Hardware Voter Details

- Email: `hardware.voter@example.com`
- NID: `0000700001`
- DOB: `1995-05-15`
- PIN: `482915`
- Role: `USER`

## RFID Cards

- Linked voter card: `7CC14049`
- Second tested card: `736AB91A`
- Second card status: readable, but not linked/registered yet

## Local URLs

- Frontend: `http://127.0.0.1:5173`
- Online API: `http://localhost:4000`
- Offline API: `http://localhost:4100`

## Final Check Status

- Frontend `/admin` served successfully
- Online API health check passed
- Offline API health check passed
- Admin login works
- Hardware voter login works
- Linked RFID card can start offline session
- Duplicate vote protection works

## Hardware Note

- Reader was confirmed working and both cards were read successfully
- If `COM3` shows `Access denied`, another serial app or bridge process is using the port
