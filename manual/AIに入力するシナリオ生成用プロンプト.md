あなたは優秀なノベルゲームのシナリオライター兼スクリプターです。
以下の【システム仕様】および【使用可能アセット一覧】に従って、【シナリオ要件】を満たすノベルゲームのシナリオデータを作成してください。

出力はスプレッドシートにそのまま貼り付けられるよう、ヘッダーを含めた「タブ区切り（TSV）形式」とし、コードブロック（```tsv 〜 ```）で囲んで出力してください。

# 【システム仕様】
ヘッダーの列は必ず以下の順序（全16列）で出力してください。
cmd, name, text, text_rubi, cond, font, fontsize, color, outline, pos, dir, src, to, voice_type, voice_id, duration

■ 列の役割
・cmd : 命令コマンド（空欄の場合はテキストダイアログ表示）
・name : 発言者名、フラグ名、エフェクト名、パーティクル名
・text : シナリオ本文、選択肢テキスト、フラグ操作値、チャプタータイトル
・text_rubi : ※使用しません（常に空欄）
・cond : 実行条件。JSの条件式を記述。フラグは直接参照可能（例: 好感度 > 5、アイテム == true）。空欄なら無条件実行。
・font, fontsize, color, outline : テキストやチャプター画面の装飾指定（通常は空欄）
・pos : キャラや演出の対象位置（left, center, right, screen, popup）
・dir : 読み込むファイルのフォルダ（images, soundsのいずれか）
・src : ファイル名（※必ず後述の【使用可能アセット一覧】から選ぶこと）
・to : ジャンプ先のマーク名、またはフェードの挙動
・voice_type, voice_id : ボイス設定（通常は空欄）
・duration : アニメーション時間（ミリ秒。例: 1000）

■ 使用可能なcmd（コマンド）全一覧
・[空欄] : テキストを表示。nameに発言者名、textに台詞。
・bg : 背景変更（dir: images, src: ファイル名）
・bgm : BGM再生（dir: sounds, src: ファイル名）※srcを空にすると停止
・se : SE再生（dir: sounds, src: ファイル名）
・show : キャラ表示（pos: left/center/right, dir: images, src: ファイル名, name: キャラ名）
・hide : キャラ非表示（pos: left/center/right）
・hideAll : 全キャラ非表示
・fade : 画面暗転（to: black/out, duration: ミリ秒）
・effect : 揺れ等の演出。posに screen かキャラ位置を指定し、nameに shake, hop, clear のいずれかを指定。
・particle : 画面エフェクト。nameに rain, snow, sparkle, wind, clear のいずれかを指定。
・item : アイテムの画像を画面中央にポップアップ表示。クリックで閉じる。（dir: images, src: ファイル名）
・chapter : 章間演出。画面が黒くなりタイトルが出る（text: 章タイトル）
・choice : 選択肢（text: 選択肢の文、to: 飛び先のマーク名、cond: 出現条件）
・jump : シナリオスキップ（to: 飛び先のマーク名）
・mark : jumpの飛び先目印（text: マーク名）
・flag : フラグ操作。nameにフラグ名、textに代入値（true, false, reset, または加算する数値）
・minigame : ミニゲーム呼び出し（dir: minigames, src: ファイル名, pos: popup）
・end : ゲームクリア・終了

# 【使用可能アセット一覧】
シナリオ内で使用する画像（images）や音声（sounds）は、必ず以下のリストから選択して src 列に記述してください。これ以外の架空のファイル名は絶対に出力しないでください。

■ images フォルダ（背景・キャラクター・アイテム等）
・bg_room.jpg （主人公の部屋）
・bg_school.jpg （学校の教室）
・char_heroine_smile.png （ヒロインの笑顔）
・char_heroine_sad.png （ヒロインの悲しい顔）
・item_key.png （鍵の画像）
※必要に応じて追加・変更してください

■ sounds フォルダ（BGM・SE等）
・bgm_theme.mp3 （メインテーマ / 明るい）
・bgm_tension.mp3 （緊張感のある曲）
・se_door.mp3 （ドアが開く音）
・se_bell.mp3 （学校のチャイム）
※必要に応じて追加・変更してください

# 【シナリオ要件】
以下の設定に沿って、起承転結と演出（音・エフェクト・分岐）に富んだシナリオ（50〜80行程度）を作成してください。

・テーマ：〇〇〇〇（例：探偵の事件解決、魔法学園での試験など）
・登場人物1：〇〇〇〇（性格・口調の特徴：〇〇〇〇）
・登場人物2：〇〇〇〇（性格・口調の特徴：〇〇〇〇）
・全体のあらすじ：〇〇〇〇
・必須要件：シナリオ内で最低1回はフラグ(flag)を獲得させ、そのフラグを使った条件分岐(cond)で展開を変化させてください。

# 【出力フォーマット例】
※以下は構造を理解するためのカンマ区切り(CSV)での例です。
※あなたが実際に出力する際は、カンマを「タブ文字（\t）」に置き換えたTSV形式で出力してください。

cmd,name,text,text_rubi,cond,font,fontsize,color,outline,pos,dir,src,to,voice_type,voice_id,duration
chapter,,第1章 開幕,,,,,,,,,,,,,
bg,,,,,,,,,,images,bg_room.jpg,,,,
bgm,,,,,,,,,,sounds,bgm_theme.mp3,,,,
particle,snow,,,,,,,,,,,,,,,
show,,,,,,,,,,center,images,char_heroine_smile.png,,,,
,ヒロイン,遅れてごめんなさい！,,,,,,,,,,,,,
choice,,許す,,,,,,,,,,mark_A,,,
choice,,許さない,,,,,,,,,,mark_B,,,
jump,,,,,,,,,,,,mark_A,,,
mark,,mark_A,,,,,,,,,,,,,
flag,好感度,1,,,,,,,,,,,,,
effect,hop,,,,,,,,center,,,,,,
,ヒロイン,ありがとう！,,,,,,,,,,,,,
jump,,,,,,,,,,,,mark_end,,,
mark,,mark_B,,,,,,,,,,,,,
show,,,,,,,,,,center,images,char_heroine_sad.png,,,,
,ヒロイン,そんな……ひどいです。,,,,,,,,,,,,,
mark,,mark_end,,,,,,,,,,,,,
item,,,,,,,,,,images,item_key.png,,,,
flag,鍵入手,true,,,,,,,,,,,,,
,主人公,（鍵を手に入れた）,,,,,,,,,,,,,
choice,,扉を開ける,鍵入手 == true,,,,,,,,,mark_open,,,
choice,,帰る,,,,,,,,,,mark_bad,,,
jump,,,,,,,,,,,,mark_open,,,
mark,,mark_open,,,,,,,,,,,,,
se,,,,,,,,,,sounds,se_door.mp3,,,,
end,,,,,,,,,,,,,,,

それでは、上記の仕様を完全に理解した上で、TSV形式でシナリオデータを出力してください。