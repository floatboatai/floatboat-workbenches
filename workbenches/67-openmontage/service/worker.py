"""Run the pinned, unmodified OpenMontage post-production tools."""
import json, os, sys
from pathlib import Path
source=Path(os.environ['OPENMONTAGE_SOURCE']).resolve()
sys.path.insert(0,str(source))
from tools.video.video_trimmer import VideoTrimmer
from tools.video.video_stitch import VideoStitch
folder=Path(sys.argv[1]).resolve()
plan=json.loads((folder/'plan.json').read_text())
trimmed=[]
for i,shot in enumerate(plan['shots']):
    original=folder.parent/'media'/(shot['source']['id']+'.mp4')
    probe=VideoStitch().execute({'operation':'validate','clips':[str(original)]})
    if not probe.success:raise RuntimeError('素材无法读取')
    duration=probe.data['clips'][0]['duration']
    if float(shot['end'])>duration+0.05:raise ValueError('镜头出点超出原片时长')
    target=folder/(str(i)+'.mp4')
    result=VideoTrimmer().execute({'operation':'cut','input_path':str(original),'output_path':str(target),'start_seconds':float(shot['start']),'end_seconds':float(shot['end']),'codec':'libx264'})
    if not result.success:raise RuntimeError('镜头裁切失败: '+str(result.error))
    trimmed.append(str(target))
result=VideoStitch().execute({'operation':'stitch','clips':trimmed,'output_path':str(folder/'output.mp4'),'transition':'cut','auto_normalize':True,'target_resolution':'1280x720','target_fps':24,'preset':'fast'})
if not result.success:raise RuntimeError('镜头拼接失败: '+str(result.error))
(folder/'tool-result.json').write_text(json.dumps({'tool':'OpenMontage VideoTrimmer + VideoStitch','data':result.data},ensure_ascii=False))
print(json.dumps({'success':True,'duration':result.data['duration']}))
