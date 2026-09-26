window.VEXA_VIDEOS = Array.from({length:36},(_,i)=>{
  const n=i+1;
  return {id:n,title:`Sample Video ${n}`,thumbnail:`https://placehold.co/640x360/111/fff?text=Vexa+Video+${n}`,preview:"",video:n<=3?`videos/video${n}.mp4":"",download:n<=3?`videos/video${n}.mp4":"",views:1200+n*137,likes:80+n*9,dislikes:2+(n%5),category:n%3===0?'Entertainment':n%3===1?'Music':'Community',tags:[n%2?'video':'featured',n%3===0?'entertainment':n%3===1?'music':'community'],duration:`${12+n} sec`,quality:n%4===0?'HD':''};
});
