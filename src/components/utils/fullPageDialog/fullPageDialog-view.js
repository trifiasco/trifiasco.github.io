import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
// import CloseIcon from '@material-ui/core/icons/Close';
import Slide from '@material-ui/core/Slide';
import ReactPDF from 'react-pdf';
import Resume from './Arnab_Roy_Resume.pdf';

const useStyles = makeStyles((theme) => ({
  appBar: {
    position: 'relative',
  },
  title: {
    marginLeft: theme.spacing(2),
    flex: 1,
  },
}));

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function FullScreenDialog() {
  const classes = useStyles();
  const [open, setOpen] = React.useState(false);
  const resumePath = `${process.env.PUBLIC_URL}/static files/Arnab_Roy_Resume.pdf`;

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <div>
        <p><a className="btn btn-primary btn-learn" onClick={handleClickOpen}  >View CV<i className="icon-download4" /></a></p>
      {/* <Button variant="text" color="primary" onClick={handleClickOpen}>
        What is it?
      </Button> */}
      {/* <Button variant="text" color="secondary" onClick={() => {window.open('https://github.com/trifiasco/horcruxifier-web-backend/issues')}}>Report a bug</Button> */}
      <Dialog fullScreen open={open} onClose={handleClose} TransitionComponent={Transition}>
        <AppBar className={classes.appBar}>
          <Toolbar>
            {/* <IconButton edge="start" color="inherit" onClick={handleClose} aria-label="close">
              <CloseIcon />
            </IconButton> */}
            <Typography variant="h6" className={classes.title}>
              Resume Viewer
            </Typography>
            <Button autoFocus variant="outlined" color="default" onClick={handleClose}>
              Close
            </Button>
          </Toolbar>
        </AppBar>

        <DialogContent>
          <DialogContentText style={{color:'black'}}>
          {/* <ReactPDF file={{Resume}} /> */}
                <div id='viewer' style={{width: '100%', height:'100%'}}>
                    <object width="100%" height="800" data={resumePath} type="application/pdf">   </object>
                </div> 
            {/* <h1>Motivation</h1>
                <p>
                    Everyone has some files they want secured. How can you absolutely make sure that those are secured? Well, hypothetically you can't. Though there are multiple ways you can "Almost" make sure that your files are secured.
                </p>
                <p>
                    I don't if anyone ever thought this before or not. But J. K. Rowling, the creator of Harry Potter, showed us an wonderful way to add a layer of security over the traditional encryption schemes. <b>Remember how Voldemort wanted to make sure that it's almost impossible to kill him? Yess... By making Horcruxes!!!</b>
                </p>

                <h3>And that's what this web application does!!!</h3>
            
            <h1>How it works?</h1>
            <p>
                Basically this app takes a file and a password from the user. Then run an encryption on the file using the password as the encryption key. Then comes the extra layer - 
                <ul>
                    <li>Click on the <b>HORCRUXIFIY</b> button</li>
                    <li>Upload a file of your choice, and give a strong password. Then submit</li>
                    <li>The app takes your file and password, runs an encryption routine.</li>
                    <li><b>After the encryption, this app divides the encrypted file into several chunks</b> (Actually 7, because Voldemort did so!!)</li>
                    <li>Each chunks is written into files named after the names of the horcruxes. (fan tribute to Harry Potter ^_^)</li>
                    <li>After that, this app zip those files, and returns that to you prompting download.</li>
                    <li>After downloading, if you unzip the folder, you will find 7 different encrypted files.</li>
                </ul> 
            </p>
            <p>
                <h4>Well, now what??</h4>
                Now you have your file - <b>Encrypted and divided into multiple files</b>. You can the scatter the files into different locations(or not, your wish).
                <b>If someone has to hack your file, they have to collect all 7 files and also the password you used for encryption.</b> I would say that would not be easy!!
            </p>

            <p>
                <h4>What if I want to see my original file??</h4>
                Fear not!! This application works both ways.
                <ul>
                    <li>Click on the <b>DE-HORCRUXIFY</b> button.</li>
                    <li>You have to now upload - All the 7 encrypted files.</li>
                    <li>Give the original password</li>
                    <li>Submit, and your original file should be downloaded.</li>
                </ul>
            </p>
            <h1>Limitations</h1>
            <p>
                This is a personal project, done for purely fun purpose. I have tested against <b>images, pdfs, text</b> files. I think it should work for other files too.
                If you use it and find any bug, please report it.
            </p>
            <Button variant="contained" color="secondary" onClick={() => {window.open('https://github.com/trifiasco/horcruxifier-web-backend/issues')}}>Report a bug</Button> */}

          </DialogContentText>
        </DialogContent>
      </Dialog>
    </div>
  );
}