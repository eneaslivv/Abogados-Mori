
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

try {
    let envContent = fs.readFileSync(envPath, 'utf8');

    // RegEx to find the DATABASE_URL line and capture the password part
    // Format: postgresql://postgres:PASSWORD@host...
    const match = envContent.match(/DATABASE_URL="postgresql:\/\/postgres:(.*?)@db\.zhrcadxspabpvfhkxkbt\.supabase\.co:5432\/postgres"/);

    if (match && match[1]) {
        const rawPassword = match[1];
        // Check if it's already encoded (simple check for %)
        // But to be safe, we decode first then encode, or just take raw if user just typed it.
        // User Instructions said: "Escribe tu contraseña ahí mismo" -> implies raw text.

        // We need to be careful not to double encode if it was partially encoded, but assuming raw input.
        // However, if the user followed instructions, they pasted raw text.

        const encodedPassword = encodeURIComponent(rawPassword);

        if (rawPassword !== encodedPassword) {
            const newUrl = `postgresql://postgres:${encodedPassword}@db.zhrcadxspabpvfhkxkbt.supabase.co:5432/postgres`;
            const newEnvContent = envContent.replace(match[0], `DATABASE_URL="${newUrl}"`);

            fs.writeFileSync(envPath, newEnvContent);
            console.log('Successfully encoded password in .env');
        } else {
            console.log('Password does not require encoding or is already safe.');
        }
    } else {
        console.log('Could not find DATABASE_URL in expected format.');
    }
} catch (error) {
    console.error('Error fixing .env:', error);
}
