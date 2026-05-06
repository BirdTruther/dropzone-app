import { NextRequest, NextResponse } from 'next/server';

// Facebook Data Deletion Callback
// Facebook POSTs a signed_request param here when a user requests data deletion
// We must respond with a JSON body containing a status URL and a confirmation code
// Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const signedRequest = params.get('signed_request');

    // Generate a simple confirmation code (can be any unique string)
    const confirmationCode = `dropzone-${Date.now()}`;

    // The status URL Facebook will show to the user
    const statusUrl = `${process.env.NEXTAUTH_URL ?? 'https://link.birdsserver.cfd'}/data-deletion`;

    return NextResponse.json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// Also handle GET so the validator can ping it
export async function GET() {
  const statusUrl = `${process.env.NEXTAUTH_URL ?? 'https://link.birdsserver.cfd'}/data-deletion`;
  return NextResponse.json({
    url: statusUrl,
    confirmation_code: `dropzone-test-${Date.now()}`,
  });
}
