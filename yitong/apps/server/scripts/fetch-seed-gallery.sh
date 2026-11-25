#!/bin/bash
# 种子配图：从 Wikimedia Commons 搜真实摄影图（curl + python 组合，node fetch 在本机不通）
# 用法: bash fetch-seed-gallery.sh [id,id...]  （缺省跑全部）
set -u
OUT="H:/副业/仿校园小程序开发/project/yitong/apps/server/.seed-media/gallery"
TMP="C:/Users/24235/AppData/Local/Temp"
mkdir -p "$OUT"

declare -A Q
Q[c03]="malatang|chinese street food noodle"
Q[c05]="handwritten notes study desk|study notes highlighter"
Q[c06]="university study room empty|reading room desk window"
Q[c09]="stadium running track sunset|sports field dusk"
Q[c11]="orange tabby cat street|orange cat sitting"
Q[c12]="fried rice plate|egg fried rice"
Q[c13]="acoustic guitar night street|guitar leaning wall"
Q[c17]="bicycle repair shop street|bicycle repair tools"
Q[c19]="university library night reading|library study lamps night"
Q[c21]="cat sleeping classroom|cat sleeping on desk"
Q[c22]="stack of textbooks desk|exam review books"
Q[c24]="bicycle shed dormitory|bicycles parked campus"
Q[c27]="street lamp night park|street light evening road"
Q[c28]="badminton court indoor|badminton racket shuttlecock"
Q[c31]="tuxedo cat street|black and white cat"
Q[c33]="egg drop soup bowl|chinese soup bowl"
Q[c35]="secondhand book stall market|old books flea market"
Q[c37]="vending machine night street|drink vending machine"
Q[c40]="empty classroom night desks|lecture hall empty"
Q[c41]="delivery scooter rain street|rainy street umbrella"
Q[c45]="chinese breakfast steamed buns|baozi breakfast"
Q[c46]="flower stall roses street|roses flower bucket"
Q[c48]="dormitory corridor night|night window warm light building"
Q[t01]="earphones on bed|earbuds smartphone desk"
Q[t03]="rain drops window night|rainy window city lights"
Q[t04]="spicy hot pot bowl|malatang spicy soup"
Q[t07]="laptop screen dark room|computer desk night"
Q[t09]="kite stuck in tree|kite flying park"
Q[t12]="tie-dye t-shirt|pink t-shirt folded"
Q[t15]="braised beef potatoes bowl|chinese stew beef dish"
Q[t16]="hotpot meal overhead|chinese hotpot table"
Q[t18]="vocabulary notebook handwriting|english notebook study"
Q[t21]="rice porridge breakfast bowl|congee chinese breakfast"
Q[t23]="smartphone glow night hands|phone screen dark room"
Q[t26]="full moon over buildings|full moon city night"
Q[t29]="old book title page handwriting|antique book pages"
Q[t30]="white chrysanthemum vase|white flowers windowsill"
Q[t32]="running track night floodlights|athletics track night"
Q[t36]="train window night lights|bus window night"
Q[t39]="cozy sofa plants corner|cozy room interior sofa plants"
Q[t43]="balcony view dusk city|city sunset balcony"
Q[t49]="mandarin orange close up|tangerine fruit table"

ids_input="${1:-}"
if [ -n "$ids_input" ]; then
  IFS=',' read -ra IDS <<< "$ids_input"
else
  IDS=("${!Q[@]}")
fi

TOTAL_OK=0
NORESULT=()
for id in "${IDS[@]}"; do
  terms="${Q[$id]:-}"
  [ -z "$terms" ] && continue
  got=0
  IFS='|' read -ra TERMS <<< "$terms"
  for term in "${TERMS[@]}"; do
    [ $got -ge 3 ] && break
    enc=$(python -c "import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))" "$term")
    url="https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${enc}%20filetype:bitmap&gsrnamespace=6&gsrlimit=8&gsrsort=relevance&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=800&format=json"
    code=$(curl -6 -s --retry 4 --retry-all-errors --retry-delay 8 -w "%{http_code}" --max-time 30 "$url" -o "$TMP/ov_$id.json")
    if [ "$code" != "200" ]; then echo "  search fail [$term] HTTP=$code"; continue; fi
    mapfile -t urls < <(python "C:/Users/24235/AppData/Local/Temp/parse_commons_urls.py" "$TMP/ov_$id.json")
    for u in "${urls[@]}"; do
      [ $got -ge 3 ] && break
      n=$((got + 1))
      f="$OUT/$id-$n.jpg"
      [ -f "$f" ] && { got=$n; continue; }
      # curl -o 写中文路径会静默失败（sz=0），先下到 ASCII 临时路径再 mv；
      # 本机到 Wikimedia 仅 IPv6 可达且飘忽，--retry 磨
      tmpf="$TMP/dl_$id-$n.jpg"
      code_sz=$(curl -6 -s --retry 5 --retry-all-errors --retry-delay 10 --max-time 120 "$u" -o "$tmpf" -w '%{http_code} %{size_download}')
      code=${code_sz%% *}
      sz=${code_sz##* }
      if [ "$code" != "200" ] || [ "${sz:-0}" -lt 15000 ]; then
        echo "  dl fail [$term] HTTP=$code sz=${sz:-NA}"
        rm -f "$tmpf"; continue
      fi
      mv "$tmpf" "$f"
      got=$n
      TOTAL_OK=$((TOTAL_OK + 1))
      echo "ok $id-$n ($((sz / 1024))KB) <- $term"
    done
    sleep 1
  done
  if [ $got -eq 0 ]; then NORESULT+=("$id"); fi
  echo "== $id: ${got} 张"
done
echo
echo "DONE totalOk=$TOTAL_OK noResult=[${NORESULT[*]-}]"
