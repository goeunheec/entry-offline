'use strict';

var fs = require('fs');
var sizeOf = require('image-size');
var path = require('path');
var Q = require('q');
var gm = require('gm');
var gui = require('nw.gui');
var isOsx = false;
var fstream = require('fstream');
var tar = require('tar');
var zlib = require('zlib');

// Create menu
var menu = new gui.Menu({
	type : 'menubar'
});

var shortCutObj = {};
if (process.platform === 'darwin') {
	isOsx = true;
	// create MacBuiltin
	menu.createMacBuiltin('Entry', {
		hideEdit : true,
		hideWindow : true
	});
	shortCutObj = {
		'newProject' : {
			'key' : 'n',
			'modifiers' : 'cmd'
		},
		'loadWorkspace' : {
			'key' : 'o',
			'modifiers' : 'cmd'
		},
		'saveWorkspace' : {
			'key' : 's',
			'modifiers' : 'cmd'
		},
		'saveAsWorkspace' : {
			'key' : 's',
			'modifiers' : 'cmd + shift'
		},
		'undo' : {
			'key' : 'z',
			'modifiers' : 'cmd'
		},
		'redo' : {
			'key' : 'z',
			'modifiers' : 'cmd + shift'
		}
	}
} else {
	isOsx = false;
	shortCutObj = {
		'newProject' : {
			'key' : 'n',
			'modifiers' : 'ctrl'
		},
		'loadWorkspace' : {
			'key' : 'o',
			'modifiers' : 'ctrl'
		},
		'saveWorkspace' : {
			'key' : 's',
			'modifiers' : 'ctrl'
		},
		'saveAsWorkspace' : {
			'key' : 's',
			'modifiers' : 'ctrl + shift'
		},
		'undo' : {
			'key' : 'z',
			'modifiers' : 'ctrl'
		},
		'redo' : {
			'key' : 'y',
			'modifiers' : 'ctrl'
		},
		'quit' : {
			'key' : 'x',
			'modifiers' : 'ctrl'
		}
	}
}
// Create file-menu
var fileMenu = new gui.Menu();
// Create edit-menu
var editMenu = new gui.Menu();

fileMenu.append(new gui.MenuItem({
	label : Lang.Workspace.file_new,
	click : function () {
		angular.element('[data-ng-controller="HeaderController"]').scope().newProject();
	},
	key: shortCutObj.newProject.key,
  	modifiers: shortCutObj.newProject.modifiers
}));
fileMenu.append(new gui.MenuItem({
	label : Lang.Workspace.file_open,
	click : function () {
		angular.element('[data-ng-controller="HeaderController"]').scope().loadWorkspace();
	},
	key: shortCutObj.loadWorkspace.key,
  	modifiers: shortCutObj.loadWorkspace.modifiers
}));
fileMenu.append(new gui.MenuItem({
	type : 'separator'
}));
fileMenu.append(new gui.MenuItem({
	label : Lang.Workspace.file_save,
	click : function () {
		angular.element('[data-ng-controller="HeaderController"]').scope().saveWorkspace();
	},
	key: shortCutObj.saveWorkspace.key,
  	modifiers: shortCutObj.saveWorkspace.modifiers
}));
fileMenu.append(new gui.MenuItem({
	label : Lang.Workspace.file_save_as,
	click : function () {
		angular.element('[data-ng-controller="HeaderController"]').scope().saveAsWorkspace();
	},
	key: shortCutObj.saveAsWorkspace.key,
  	modifiers: shortCutObj.saveAsWorkspace.modifiers
}));
if(!isOsx) {
	fileMenu.append(new gui.MenuItem({
		type : 'separator'
	}));
	fileMenu.append(new gui.MenuItem({
		label : '종료',
		click : function () {
			gui.App.quit();
		},
		key: shortCutObj.quit.key,
	  	modifiers: shortCutObj.quit.modifiers
	}));
}

editMenu.append(new gui.MenuItem({
	label : '되돌리기',
	click : function () {
		Entry.dispatchEvent('undo');
	},
	key: shortCutObj.undo.key,
  	modifiers: shortCutObj.undo.modifiers
}));

editMenu.append(new gui.MenuItem({
	label : '다시실행',
	click : function () {
		Entry.dispatchEvent('redo');
	},
	key: shortCutObj.redo.key,
  	modifiers: shortCutObj.redo.modifiers
}));

// Append MenuItem as a Submenu
menu.append(new gui.MenuItem({
	label : '파일',
	submenu : fileMenu
}));
menu.append(new gui.MenuItem({
	label : '편집',
	submenu : editMenu
}));

// Append Menu to Window
gui.Window.get().menu = menu;



// plugin
Entry.plugin = (function () {
	var that = {};

	var TARGET_SIZE = 960;
	var THUMB_SIZE = 96;

	var getUploadPath = function(fileId) {

	    // prepare upload directory
	    var baseDir = './temp';
	    var uploadDir = path.join(baseDir, fileId.substr(0,2), fileId.substr(2,2));

	    if (!fs.existsSync(path.join(baseDir, fileId.substr(0,2))))
	        fs.mkdirSync(path.join(baseDir, fileId.substr(0,2)));

	    if (!fs.existsSync(path.join(baseDir, fileId.substr(0,2), fileId.substr(2,2))))
	        fs.mkdirSync(path.join(baseDir, fileId.substr(0,2), fileId.substr(2,2))); // uploadDir

	    if (!fs.existsSync(path.join(uploadDir, 'thumb')))
	        fs.mkdirSync(path.join(uploadDir, 'thumb'));

	    if (!fs.existsSync(path.join(uploadDir, 'image')))
	        fs.mkdirSync(path.join(uploadDir, 'image'));
			
		if (!fs.existsSync(path.join(uploadDir, 'sound')))
			fs.mkdirSync(path.join(uploadDir, 'sound'));

	    //Path of upload folder where you want to upload fies/
	    var thumbPath = path.join(uploadDir, 'thumb', fileId + '.png'); // thumbnail
	    var imagePath = path.join(uploadDir, 'image', fileId + '.png'); // main image
		var soundPath = path.join(uploadDir, 'sound', fileId + '.png'); // for sound file


	    var baseUrl = path.join(fileId.substr(0,2) + '/' + fileId.substr(2,2)); // uploads/xx/yy/[tmp/thumb/image]/[hashkey].png

	    return {
	        uploadDir: uploadDir,
	        thumbPath: thumbPath,
	        imagePath: imagePath,
			soundPath: soundPath,
	        baseUrl: baseUrl
	    }

	};

	var deleteFolderRecursive = function(path) {
		if( fs.existsSync(path) ) {
		    fs.readdirSync(path).forEach(function(file,index){
			    var curPath = path + "/" + file;
			    if(fs.lstatSync(curPath).isDirectory()) { // recurse
			        deleteFolderRecursive(curPath);
			    } else { // delete file
			        fs.unlinkSync(curPath);
			    }
		    });
		    fs.rmdirSync(path);
		}
	};

	var createFileId = function() {
		var randomStr = (Math.random().toString(16)+"000000000").substr(2,8);
	    return require('crypto').createHash('md5').update(randomStr).digest("hex");
	};

	// 프로젝트 저장 
	that.saveProject = function(path, data, cb, enc) {
		var string_data = JSON.stringify(data);
		that.mkdir('./temp', function () {
			fs.writeFile('./temp/project.json', string_data, enc || 'utf8', function (err) {
				if(err) {
					throw err;
				}

				var fs_reader = fstream.Reader({ 'path': 'temp/', 'type': 'Directory' });

				var fs_writer = fstream.Writer({ 'path': path, 'type': 'File' });

				fs_writer.on('entry', function () {
					// console.log('entry');
				});
				fs_writer.on('end', function () {
					
					if($.isFunction(cb)){
						cb();
					}
				});

				fs_reader.pipe(tar.Pack()) 
					.pipe(zlib.Gzip())
					.pipe(fs_writer)

			});
		});		
	}

	// 프로젝트 불러오기
	that.loadProject = function(path, cb, enc) {
		deleteFolderRecursive('temp/');

		var fs_reader = fstream.Reader({ 'path': path, 'type': 'File' });
		var fs_writer = fstream.Writer({ 'path': '.', 'type': 'Directory' });

		fs_writer.on('entry', function () {
			// console.log('entry');
		});
		fs_writer.on('end', function () {
			fs.readFile('./temp/project.json', enc || 'utf8', function (err, data) {
				if(err) {
					throw err;
				}

				if($.isFunction(cb)) {
					cb(data);
				}
			});
		});

		fs_reader.pipe(zlib.Gunzip())
			.pipe(tar.Parse())
			.pipe(fs_writer);
	}

	that.initProjectFolder = function (cb) {
		deleteFolderRecursive('./temp/');
		that.mkdir('./temp/', function () {
			if($.isFunction(cb)) {
				cb();
			};
		});
	};


	// 파일 저장
	that.writeFile = function(path, data, cb, enc) {
		fs.writeFile(path, data, enc || 'utf8', function (err) {
			if(err) {
				throw err;
			}

			if($.isFunction(cb)) {
				cb();
			}
		});
	}

	// 파일 열기
	that.readFile = function(path, cb, enc) {
		fs.readFile(path, enc || 'utf8', function (err, data) {
			if(err) {
				throw err;
			}

			if($.isFunction(cb)) {
				cb(data);
			}
		});
	}

	that.mkdir = function(path, cb) {
		fs.access(path, function (err, files) {
			if(err){
				fs.mkdir(path, function (err) {
					if(err) {
						throw err;
					}

					if($.isFunction(cb)) {
						cb();
					}
				});
			} else {
				if($.isFunction(cb)) {
					cb();
				}
			}
		})
	}

	//임시 이미지 저장
	that.saveTempImageFile = function (data, cb) {
	    var fileId = createFileId();
		var dest = getUploadPath(fileId);
		that.mkdir(dest.uploadDir + '/image', function () {
			fs.writeFile(dest.imagePath + '.png', data.org, { encoding: 'base64' }, function (err) {
				that.mkdir(dest.uploadDir + '/thumb', function () {
					fs.writeFile(dest.thumbPath + '.png', data.thumb, { encoding: 'base64' }, function (err) {
						if(err) {
							throw err;
						}

						var dimensions = sizeOf('./' + dest.imagePath);
						var picture = {
							type : 'user',
							name : fileId,
							filename : fileId,
							fileurl : dest.imagePath,
							dimension : dimensions
						}
						
						if($.isFunction(cb)) {
							cb(picture);
						}
					});
				});
			});
		});
	}
	
	//사운드 파일 저장
	that.saveTempSoundFile = function (data, cb) {
	    var randomStr = (Math.random().toString(16)+"000000000").substr(2,8);
	    var fileId = require('crypto').createHash('md5').update(randomStr).digest("hex");

		//var sound = new Buffer(data, 'base64');
		var dest = getUploadPath(fileId);

		that.mkdir(dest.uploadDir + '/sound', function () {
			fs.writeFile(dest.soundPath, data.org, { encoding: 'base64' }, function (err) {
				if(err) {
					throw err;
				}

				var dimensions = sizeOf('./' + dest.soundPath);
				var sound = {
					type : 'user',
					name : fileId,
					filename : fileId,
					fileurl : dest.soundPath,
					dimension : dimensions
				}
				
				if($.isFunction(cb)) {
					cb(sound);
				}
			});
				
		});
	}
	};

	that.getResizeImageFromBase64 = function (image, canvas, max_size) {
        var tempW = image.width;
        var tempH = image.height;
        if (tempW > tempH) {
            if (tempW > max_size) {
               tempH *= max_size / tempW;
               tempW = max_size;
            }
        } else {
            if (tempH > max_size) {
               tempW *= max_size / tempH;
               tempH = max_size;
            }
        }
        
        canvas.width = tempW;
        canvas.height = tempH;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, tempW, tempH);
        
        return canvas.toDataURL().split(',')[1];
    }

	that.uploadTempImageFile = function (images, cb) {
		var images_cnt = images.length;
		var run_cnt = 0;
		var pictures = [];
		images.forEach(function (url, index) {
			var fileId = createFileId();
			var dest = getUploadPath(fileId);
			var url_split = url.split('/');
			var extension = '.' + url_split[url_split.length-1].split('.')[1];
			var file_name = url_split[url_split.length-1].split('.')[0];
			var imagePath = dest.imagePath + extension;
			var fs_reader = fs.createReadStream(url);
			var fs_writer = fs.createWriteStream(imagePath);
			
			that.mkdir(dest.uploadDir + '/image', function () {
				fs.readFile(url, function (err, stream) {
					fs.writeFile(imagePath, stream, function (err) {
						if(err) {
							throw err;
						}
						var image = new Image();
						image.src = imagePath;
						image.onload = function () {
							var canvas = document.createElement('canvas');
			        		canvas.width = image.width;
			        		canvas.height = image.height;
					    	var ctx = canvas.getContext("2d");
					    	ctx.drawImage(this, 0, 0, canvas.width, canvas.height);
					    	var thumb = that.getResizeImageFromBase64(image, canvas, THUMB_SIZE);

					    	fs.writeFile(dest.thumbPath + extension, thumb, { encoding: 'base64' }, function (err) {
								if(err) {
									throw err;
								}

								var dimensions = sizeOf(imagePath);
								var picture = {
									_id : Entry.generateHash(),
									type : 'user',
									name : file_name,
									filename : fileId,
									fileurl : imagePath,
									dimension : dimensions
								}

								pictures.push(picture);

								if($.isFunction(cb) && ++run_cnt === images_cnt) {
									cb(pictures);
								}
							});
						};
					});
				});
			});

		});
	};

	return that;
})();