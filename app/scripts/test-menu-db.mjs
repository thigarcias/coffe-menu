process.on('uncaughtException', (error) => { console.error('ERRO:', error.message); process.exit(1) });
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated; create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text); alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated; grant select,insert on storage.objects to authenticated; grant select on storage.objects to anon;`)
const sql=await readFile(new URL('../supabase/migrations/20261114015222_coffe_menu_personalizacao.sql', import.meta.url),'utf8')
await db.exec(sql)
const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', cafe='33333333-3333-4333-8333-333333333333'
await db.query('insert into auth.users(id) values ($1),($2)', [owner,other])
await db.query('insert into public.cafes(id,owner_id,slug,name) values ($1,$2,$3,$4)',[cafe,owner,'cafe-teste','Café'])
await db.exec(`set role anon`)
let {rows}=await db.query('select public.get_published_menu($1) as data',['cafe-teste'])
assert.ok(rows[0].data && rows[0].data.menu === null, 'unidade sem publicação deve retornar menu nulo')
await db.exec(`reset role; set role authenticated`)
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
let output=await db.query('select public.create_menu_draft($1,$2,$3::jsonb) as data',[cafe,'Novo',JSON.stringify({cafe:{name:'Café'},categories:[],items:[]})]); let draft=output.rows[0].data
assert.ok(draft.draft_id)
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other])
output=await db.query('select public.list_my_cafes() as data'); assert.equal(output.rows[0].data.length,0)
await assert.rejects(() => db.query('select public.save_menu_draft($1,$2,$3,$4::jsonb)',[cafe,draft.draft_id,1,JSON.stringify({})]))
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
await assert.rejects(() => db.query('select public.publish_menu_draft($1,$2,$3)',[cafe,draft.draft_id,1]))
await assert.rejects(() => db.query('select public.save_menu_draft($1,$2,$3,$4::jsonb)',[cafe,draft.draft_id,99,JSON.stringify({})]))

const image = cafe + '/44444444-4444-4444-8444-444444444444.jpg'
await db.exec('reset role')
await db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['coffe-menu-media',image])
await db.exec('set role authenticated')
const menu = {cafe:{name:'Minha cafeteria'},categories:[{id:'cafes',name:'Cafés'}],items:[{id:'item',name:'Café',category:'cafes',image,prices:[{size:'Único',price:5}]}]}
let saved=await db.query('select public.save_menu_draft($1,$2,$3,$4::jsonb) as data',[cafe,draft.draft_id,1,JSON.stringify(menu)])
assert.equal(saved.rows[0].data.version,2)
await db.query('select public.publish_menu_draft($1,$2,$3)',[cafe,draft.draft_id,2])
await db.query('select public.set_product_availability($1,$2,$3)',[cafe,'item',false])
const restored=await db.query('select public.restore_menu_draft_version($1,$2,$3) as data',[cafe,draft.draft_id,saved.rows[0].data.version_id])
assert.notEqual(restored.rows[0].data.draft_id,draft.draft_id)
const savedAgain=await db.query('select public.save_menu_draft($1,$2,$3,$4::jsonb) as data',[cafe,draft.draft_id,2,JSON.stringify({...menu,cafe:{name:'Outra versão'}})])
await db.query('select public.publish_menu_draft($1,$2,$3)',[cafe,draft.draft_id,savedAgain.rows[0].data.version])
await db.exec('reset role')
await db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['coffe-menu-media',cafe + '/55555555-5555-4555-8555-555555555555.png'])
await db.exec('set role anon')
const publicImages = await db.query('select name from storage.objects where bucket_id = $1', ['coffe-menu-media'])
assert.deepEqual(publicImages.rows.map((row) => row.name), [image], 'imagens não publicadas devem permanecer privadas')
await assert.rejects(() => db.query('select * from public.menu_drafts'))
const published=await db.query('select public.get_published_menu($1) as data',['cafe-teste'])
assert.equal(published.rows[0].data.menu.items[0].name,'Café'); assert.equal(published.rows[0].data.availability.item,false)
console.log('Migração, isolamento, rascunho, publicação, restauração e disponibilidade passaram.')
await db.close()


