// API endpoint for controller database
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CONTROLLERS_FILE = path.join(
  process.cwd(),
  'storage',
  'controllers.json'
);

export async function GET() {
  try {
    const data = await fs.readFile(CONTROLLERS_FILE, 'utf-8');
    const controllers = JSON.parse(data);
    return NextResponse.json(controllers);
  } catch (error) {
    console.error('Failed to load controllers database:', error);
    return NextResponse.json(
      { error: 'Failed to load controller database' },
      { status: 500 }
    );
  }
}
