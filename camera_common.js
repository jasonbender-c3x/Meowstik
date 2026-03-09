//===========本地化相关函数====================

function SetCookie(name,value, expeir)//两个参数，一个是cookie的名子，一个是值
{
    var exp  = new Date();    //new Date("December 31, 9998");
    exp.setTime(exp.getTime() + expeir*1000);
    document.cookie = name + "="+ escape (value) + ";expires=" + exp.toGMTString();
}
function getCookie(name)//取cookies函数        
{
    var arr = document.cookie.match(new RegExp("(^| )"+name+"=([^;]*)(;|$)"));
     if(arr != null) return unescape(arr[2]); return null;

}
function delCookie(name)//删除cookie
{
    var exp = new Date();
    exp.setTime(exp.getTime() - 1);
    var cval=getCookie(name);
    if(cval!=null) document.cookie= name + "="+cval+";expires="+exp.toGMTString();
}
//=========jquery相关函数============
function ajax_async(page,params) 
{
    var ajaxval = null;
    var values="";
    for ( name in params ) values += name+"="+params[name]+"&";
    values=values.substring(0,values.length-1);
    $.ajax({
        url: page,   //接收页面
        type: 'post',      //POST方式发送数据
		contentType: 'text/plain',
        async: false,      //ajax同步
        data: values,
		timeout: 30000,
        success: function(msg) {
            ajaxval = msg;
        }
    });
    return ajaxval;
}

function ajax_async_true(page,params) 
{
    var ajaxval = null;
    var values="";
    for ( name in params ) values += name+"="+params[name]+"&";
    values=values.substring(0,values.length-1);
    $.ajax({
        url: page,   //接收页面
        type: 'post',      //POST方式发送数据
		contentType: 'text/plain',
        async: true,      //ajax同步
        data: values,
        success: function(msg) {
            ajaxval = msg;
        }
    });
    return ajaxval;
}

function ajax_async_true_callback(page,params,callback) 
{
    var ajaxval = null;
    var values="";
    for ( name in params ) values += name+"="+params[name]+"&";
    values=values.substring(0,values.length-1);
    $.ajax({
        url: page,   //接收页面
        type: 'post',      //POST方式发送数据
		contentType: 'text/plain',
        async: true,      //ajax同步
        data: values,
        success: function(msg) {
			callback(msg);
        }
    });
    return ajaxval;
}

function call_cgi(cgi, in_date)
{
	//alert("got get_device_info");
    var page="cgi-bin/"+cgi;
    var params = in_date;
    var ajax_val=ajax_async(page,params);
    var json=eval("("+ajax_val+")");
	//alert(ajax_val);
    return json;
}
function call_cgi_asyn(cgi, in_date)
{
	//alert("got get_device_info");
    var page="cgi-bin/"+cgi;
    var params = in_date;
    var ajax_val=ajax_async_true(page,params);
    var json=eval("("+ajax_val+")");
	//alert(ajax_val);
    return json;
}

function call_cgi_asyn_callback(cgi, in_date, callback)
{
	//alert("got get_device_info");
    var page="cgi-bin/"+cgi;
    var params = in_date;
    ajax_async_true_callback(page,params,callback);
}

function checkocx(obj)
{
	if(typeof(obj)=='undefined')
	{
		//alert("ie6 check fail");
		return 0;	
	}
	
	try
	{
		obj.CheckUpdate("");        //延时100ms 同时切换ocx为 web模式
	}
	catch(e)
	{
		//alert("ie8 check fail");
		return 0;	
	}
	return 1;
}

function getpath(path)
{
	switch(path)
	{
		case '0': return "C";
		case '1': return "D";
		case '2': return "E";
		case '3': return "F";	
		case '4': return "G";
		case '5': return "H";	
		case '6': return "I";
		case '7': return "J";	
		case '8': return "K";
		case '9': return "L";	
		case '10': return "M";
		case '11': return "N";	
		case '12': return "O";
		case '13': return "P";	
		case '14': return "Q";
		case '15': return "R";	
		case '16': return "S";
		case '17': return "T";	
		case '18': return "U";
		case '19': return "V";	
		case '20': return "W";
		case '21': return "X";	
		case '22': return "Y";
		case '23': return "Z";	
	}
}

function checkval(inid, inval, j_min, j_max)
{
	if((parseInt(inval)<parseInt(j_min))||(parseInt(inval)>parseInt(j_max)))
	{
		alert(document.getElementById(inid).innerHTML+a[25]+"("+inval+":"+j_min+"-"+j_max+")");
		return 1;	
	}
	return 0;
}

function get_slctid(inname)
{
	return document.getElementById(inname).selectedIndex;
}

function getchecked(id)
{
	if(document.getElementById(id).checked==true)
	{
		return 1;
	}
	return 0;
}
function getchecked_byname(id,index)
{
	if(document.getElementsByName(id).item(index).checked==true)
	{
		return 1;
	}
	return 0;
}
function ocx_flush()
{
	if(typeof(DHiMPlayer)!='undefined')
	{
		DHiMPlayer.InvalidateWnd();
		//Image100.src='images/botton/capture.jpg';
	}
}

function ocx_play_port(ip,rtspport,rcfgport,obj)
{
	try
	{
		//DHiMPlayer.StopAudioOut();
		//DHiMPlayer.StopAudioIn();
		//alert(port);
		var param = {dev_num:1,opType:"get"};
		var ret=call_cgi("netinfo.cgi", param);
		
		obj.SetRcfgPort(parseInt(rcfgport));
		obj.ScreenZoomEnable(1);
		obj.ScreenPtzEnable(1);
		var flow_slct = getCookie('flow_slct');
		if(1==flow_slct)
		{
			obj.Connect(window.location.host,parseInt(rtspport),ret.u,ret.p,2,1,".h264");	
			//alert("flow_slct == 1");
		}
		else
		{
			obj.Connect(window.location.host,parseInt(rtspport),ret.u,ret.p,2,0,".h264");
			//alert("flow_slct == 0");
		}
	}
	catch(e)
	{
		return 0;	
	}
	return 1;
}

function ocx_replay_obj(chn,flow,obj,time)
{
	if(typeof(obj)!='undefined')
	{
		try
		{
			//alert("obj.ip"+ip);
			//alert("obj:"+obj);
			//DHiMPlayer.Connect(window.location.host,554,"admin","123456");
			//alert("chn:"+chn+";ip:"+window.location.host);
			var tmptime_obj=new Date();
			tmptime_obj.setTime(Number(time*1000));
			var timeinfo = "_"+tmptime_obj.getFullYear()
			if((tmptime_obj.getMonth()+1)<10)
			{
				timeinfo = timeinfo+"0"+(tmptime_obj.getMonth()+1);
			}
			else
			{
				timeinfo = timeinfo+(tmptime_obj.getMonth()+1);
			}
			if(tmptime_obj.getDate()<10)
			{
				timeinfo = timeinfo+"0"+tmptime_obj.getDate();
			}
			else
			{
				timeinfo = timeinfo+tmptime_obj.getDate();
			}
			timeinfo = timeinfo+"T";
			if(tmptime_obj.getHours()<10)
			{
				timeinfo = timeinfo+"0"+tmptime_obj.getHours();
			}
			else
			{
				timeinfo = timeinfo+tmptime_obj.getHours();
			}
			if(tmptime_obj.getMinutes()<10)
			{
				timeinfo = timeinfo+"0"+tmptime_obj.getMinutes();
			}
			else
			{
				timeinfo = timeinfo+tmptime_obj.getMinutes();
			}
			if(tmptime_obj.getSeconds()<10)
			{
				timeinfo = timeinfo+"0"+tmptime_obj.getSeconds();
			}
			else
			{
				timeinfo = timeinfo+tmptime_obj.getSeconds();
			}
			timeinfo = timeinfo+".h264";
			//alert(timeinfo);
			var param = {dev_num:1,opType:"get"};
			var ret=parent.call_cgi("netinfo.cgi", param);
			obj.SetRcfgPort(ret.rcfgport);
			//alert(ret.rcfgport+";ip "+window.location.host);
			obj.Connect(window.location.host,ret.rtspport,"admin","123456",chn,flow,timeinfo);
			return timeinfo;
		}
		catch(e)
		{
			return 0;	
		}
	}
	return 1;
}

function ocx_play_main(ip)
{
	if(typeof(DHiMPlayer)!='undefined')
	{
		try
		{
			//DHiMPlayer.StopAudioOut();
			//DHiMPlayer.StopAudioIn();
			var param = {dev_num:1,opType:"get"};
			var ret=parent.call_cgi("netinfo.cgi", param);
			var port = ret.rtspport;
			DHiMPlayer.SetRcfgPort(ret.rcfgport);
			DHiMPlayer.ScreenZoomEnable(1);
			DHiMPlayer.ScreenPtzEnable(1);
			DHiMPlayer.Connect(window.location.host,port,"admin","123456",0,0,".h264");	
			document.body.focus();
		}
		catch(e)
		{
			return 0;	
		}
	}
	return 1;
}

function unload_ocx(ocx)
{
	if(checkocx(ocx))
	{
		ocx.StopAudioOut();
		ocx.StopAudioIn();
		ocx.StopRecord();
		ocx.disconnect();
	}
}
function do_signout()
{
	SetCookie("sigin",0,24*3600);
	top.location.reload();
}

/*cn=中文 en=英文 */
var language = getCookie("language");
if(null==language) language="en";

var sigin = getCookie("sigin");
if(null==sigin) sigin=0;

var videorcd_path_cookie = getCookie('videorcd_path_cookie');
if (!videorcd_path_cookie) videorcd_path_cookie='0';

var capture_path_cookie = getCookie('capture_path_cookie');
if (!capture_path_cookie) capture_path_cookie='0';

var display_switch = getCookie('display_switch');
if (!display_switch) display_switch=0;

var display_on = getCookie('display_on');
if (!display_on) display_on=0;

var flow_slct = getCookie('flow_slct');
if (!flow_slct) flow_slct=0;

var decode_type = getCookie('decode_type');
if (!decode_type) decode_type=0;

var overlay_enable = getCookie('overlay_enable');
if (!overlay_enable) overlay_enable=0;

var showalarm_enable = getCookie('showalarm_enable');
if (!showalarm_enable) showalarm_enable=0;

var videorcd_path_cookie = getCookie('videorcd_path_cookie');
if (!videorcd_path_cookie) videorcd_path_cookie='0';

var capture_path_cookie = getCookie('capture_path_cookie');
if (!capture_path_cookie) capture_path_cookie='0';

var showalarm_enable = getCookie('showalarm_enable');
if (!showalarm_enable) showalarm_enable=0;


var clsid="clsid:63D7DBE2-955D-4CC6-B1E6-4CC8CFB3E479";
var ocxversion="RSAVPlugin2.ocx";
var fgGK710xOcxOn=0;
var fgGKRecordReplayOn=0;
var activeX;
var GKRecoed_activeX;
var fgfloatingNoLongerAppear=0;
