import { POST } from '@/app/api/analyze/route';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        stream: jest.fn().mockReturnValue({
          on: jest.fn().mockImplementation(function (
            this: any,
            event: string,
            cb: (text: string) => void
          ) {
            if (event === 'text') {
              cb('GEO SCORE: 72 / 100  🟡 Needs Work\n');
            }
            return this;
          }),
          finalMessage: jest.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'GEO SCORE: 72 / 100' }],
          }),
        }),
      },
    })),
  };
});

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/analyze', () => {
  it('returns 401 when API key is missing', async () => {
    const req = makeRequest({ targetQuery: 'best dentist', content: 'some content' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when API key is empty string', async () => {
    const req = makeRequest({ apiKey: '', targetQuery: 'best dentist', content: 'some content' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when targetQuery is missing', async () => {
    const req = makeRequest({ apiKey: 'sk-ant-test', content: 'some content' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is missing', async () => {
    const req = makeRequest({ apiKey: 'sk-ant-test', targetQuery: 'best dentist' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is empty string', async () => {
    const req = makeRequest({ apiKey: 'sk-ant-test', targetQuery: 'best dentist', content: '' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when content exceeds 60000 characters', async () => {
    const req = makeRequest({
      apiKey: 'sk-ant-test',
      targetQuery: 'best dentist',
      content: 'a'.repeat(60001),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 streaming response for valid request', async () => {
    const req = makeRequest({
      apiKey: 'sk-ant-test',
      targetQuery: 'best dentist in Cebu',
      content: 'Smith Dental Clinic is a trusted dental practice in Cebu City.',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
  });
});
