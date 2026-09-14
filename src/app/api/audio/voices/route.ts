import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // A curated list of high quality Fish Audio voices, categorized by language/gender
    // Note: To use dynamic models from the user's Fish Audio account, we could fetch from https://api.fish.audio/model
    const curatedVoices = [
      { id: '7f92f8afb8ec43bf81429cc1c9199cb1', name: 'Alex (English Male)', language: 'English', gender: 'Male' },
      { id: '2cbb6bf6e0244ad0bb8c3d11b3e7bc8c', name: 'Rachel (English Female)', language: 'English', gender: 'Female' },
      { id: 'b0a390d402374c43ba7eb79c298b172a', name: 'Marcus (English Male, Deep)', language: 'English', gender: 'Male' },
      { id: 'e28bb3e85e424ef2898cfbe03bd6b1e6', name: 'Isabella (English Female, Soft)', language: 'English', gender: 'Female' },
      { id: '5561a7a409f7435f92eb91bbf1ed052f', name: 'Kenji (Japanese Male)', language: 'Japanese', gender: 'Male' },
      { id: '3503f8a0322345e8a76b7eec9313bb53', name: 'Sakura (Japanese Female)', language: 'Japanese', gender: 'Female' },
      { id: '8a8c14a9c8b849289bf4454d1933df91', name: 'Wei (Chinese Male)', language: 'Chinese', gender: 'Male' },
      { id: 'a672a8c081e74de6b92f4405391d4e41', name: 'Lin (Chinese Female)', language: 'Chinese', gender: 'Female' },
      { id: '900b957cf01a4e528b330a10b48455d3', name: 'Pierre (French Male)', language: 'French', gender: 'Male' },
      { id: '11e24747bf644fcb8332cc97e556e9c9', name: 'Marie (French Female)', language: 'French', gender: 'Female' },
      { id: 'f568dc6f6d0a4c9fb66c61f2f84fa6e3', name: 'Hans (German Male)', language: 'German', gender: 'Male' },
      { id: 'c23f6e1f02f9435a8bc3e26fb511b846', name: 'Anna (German Female)', language: 'German', gender: 'Female' }
    ];

    return NextResponse.json({ voices: curatedVoices });
  } catch (error: any) {
    console.error('Error fetching voices:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
