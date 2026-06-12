// @ts-nocheck  (this file runs on Deno in Supabase, not in the Lens Studio TS env)
// Supabase Edge Function: identify-butterfly
// Receives { image: "data:image/jpeg;base64,..." }, calls Kindwise insect.id,
// and returns the FULL Kindwise identification result (matches the lens IDResponse type).
//
// Deploy:
//   supabase secrets set KINDWISE_API_KEY=your_key_here
//   supabase functions deploy identify-butterfly

const KINDWISE_URL =
  "https://insect.kindwise.com/api/v1/identification?details=common_names,url,description,description_gpt,description_all,taxonomy,rank,gbif_id,inaturalist_id,image,images,red_list,synonyms,danger,danger_description,role"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...corsHeaders, "Content-Type": "application/json"},
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {headers: corsHeaders})
  }

  try {
    const {image} = await req.json()
    if (!image) {
      return json({error: "Missing 'image' in request body"}, 400)
    }

    const apiKey = Deno.env.get("KINDWISE_API_KEY")
    if (!apiKey) {
      return json({error: "KINDWISE_API_KEY secret is not set"}, 500)
    }

    const kindwiseRes = await fetch(KINDWISE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        images: [image],
        similar_images: true, // leave if you want to add similar images to the species taken, remove if you want faster response with just name/details.
        suggestion_filter: {classification: "lepidoptera"},
      }),
    })

    const data = await kindwiseRes.json()

    if (!kindwiseRes.ok) {
      return json({error: "Kindwise request failed", status: kindwiseRes.status, detail: data}, 502)
    }

    return json(data)
  } catch (e) {
    return json({error: String(e)}, 500)
  }
})
